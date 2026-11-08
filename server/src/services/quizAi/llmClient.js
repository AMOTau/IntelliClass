import { env } from '../../config/env.js';

const REQUEST_TIMEOUT_MS = 90000;

const PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    token: () => env.geminiApiKey,
    models: () => [...new Set([env.geminiModel, ...env.geminiFallbackModels])],
    setupHint: 'Create a free key at https://aistudio.google.com/apikey and set GEMINI_API_KEY in server/.env.',
  },
  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    token: () => env.groqApiKey,
    models: () => [...new Set([env.groqModel, ...env.groqFallbackModels])],
    setupHint: 'Create a free key at https://console.groq.com/keys and set GROQ_API_KEY in server/.env.',
  },
  huggingface: {
    name: 'Hugging Face',
    url: 'https://router.huggingface.co/v1/chat/completions',
    token: () => env.huggingFaceToken,
    models: () => [...new Set([env.huggingFaceModel, ...env.huggingFaceFallbackModels])],
    setupHint: 'Set HUGGINGFACE_TOKEN in server/.env (Inference Providers permission + billing credits required).',
  },
};

export function activeProviderId() {
  if (PROVIDERS[env.aiProvider]) {
    return env.aiProvider;
  }
  // Auto: prefer free Gemini, then Groq, then Hugging Face.
  if (env.geminiApiKey) {
    return 'gemini';
  }
  if (env.groqApiKey) {
    return 'groq';
  }
  if (env.huggingFaceToken) {
    return 'huggingface';
  }
  return 'gemini';
}

export function activeProvider() {
  return PROVIDERS[activeProviderId()] || PROVIDERS.gemini;
}

export function describeAiFailure(error) {
  const message = String(error?.message || error || 'Unknown AI error');
  const cause = String(error?.cause?.message || error?.cause || '');
  const combined = `${message} ${cause}`.toLowerCase();
  const provider = activeProvider();

  if (combined.includes('certificate')) {
    return 'Could not securely connect to the AI service (TLS certificate issue). Restart the API with system CA support, then try again.';
  }
  if (combined.includes('abort') || combined.includes('timeout')) {
    return 'The AI service took too long to answer. Try again with fewer questions or fewer chapters.';
  }
  if (combined.includes('enotfound') || combined.includes('fetch failed')) {
    return 'Could not reach the AI service. Check your internet connection, then try again.';
  }
  if (combined.includes('not a chat model') || combined.includes('is not found') || combined.includes('not found')) {
    return `The configured ${provider.name} model was not found. Update GEMINI_MODEL in server/.env (try gemini-3.1-flash-lite) and restart the API.`;
  }
  if (combined.includes('sufficient permissions') || combined.includes('inference providers')) {
    return 'Your Hugging Face token cannot use Inference Providers. Prefer GEMINI_API_KEY (free) or GROQ_API_KEY.';
  }
  if (combined.includes('402') || combined.includes('credit') || combined.includes('quota') || combined.includes('pre-paid') || combined.includes('subscribe to pro') || combined.includes('billing')) {
    return 'Your AI provider has no free quota left. Set GEMINI_API_KEY for Google Gemini free tier, or wait for the daily limit to reset.';
  }
  if (combined.includes('429') || combined.includes('rate limit') || combined.includes('resource_exhausted')) {
    return `${provider.name} rate limit reached. Wait a minute and try again, or reduce question count.`;
  }
  if (combined.includes('401') || combined.includes('api key not valid') || combined.includes('invalid') || combined.includes('unauthorized') || combined.includes('expired')) {
    return `${provider.name} rejected the API key. Check GEMINI_API_KEY in server/.env and restart the API. ${provider.setupHint}`;
  }
  if (combined.includes('403')) {
    return `${provider.name} refused this request (403). Check the API key and model settings in server/.env.`;
  }
  if (combined.includes('not configured')) {
    return message;
  }
  return `AI generation failed (${message}).`;
}

export function extractJson(text) {
  if (!text) {
    return null;
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1] ?? text;
  const objectStart = source.indexOf('{');
  const arrayStart = source.indexOf('[');
  const useArray = arrayStart !== -1 && (objectStart === -1 || arrayStart < objectStart);
  const start = useArray ? arrayStart : objectStart;
  const end = useArray ? source.lastIndexOf(']') : source.lastIndexOf('}');

  if (start === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    return null;
  }
}

function failure(message, statusCode, retryable) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.retryable = retryable;
  return error;
}

async function postChat(provider, model, messages, maxTokens, temperature) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(provider.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.token()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));

    if (response.ok) {
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) {
        return content;
      }
      throw failure(`${provider.name} returned an empty response.`, 502, true);
    }

    const apiMessage = payload?.error?.message || payload?.error || payload?.message || `${provider.name} API (${response.status})`;
    const text = typeof apiMessage === 'string' ? apiMessage : JSON.stringify(apiMessage);
    console.error(`${provider.name} API ${response.status} [${model}]: ${text}`);
    const retryable = ![401, 402, 403].includes(response.status);
    throw failure(describeAiFailure(`${response.status} ${text}`), response.status, retryable);
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    throw failure(describeAiFailure(error), 502, false);
  } finally {
    clearTimeout(timer);
  }
}

export async function chatCompletion(messages, { maxTokens = 2000, temperature = 0.4 } = {}) {
  const provider = activeProvider();
  const token = provider.token();

  if (!token) {
    throw failure(
      `${provider.name} is not configured. ${provider.setupHint}`,
      500,
      false
    );
  }

  const models = provider.models();
  let lastError = null;

  for (const model of models) {
    try {
      const content = await postChat(provider, model, messages, maxTokens, temperature);
      return { content, model, provider: activeProviderId() };
    } catch (error) {
      lastError = error;
      if (!error.retryable) {
        throw error;
      }
    }
  }

  throw lastError || failure(`${provider.name} API request failed.`, 502, false);
}
