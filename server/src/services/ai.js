import { env } from '../config/env.js';
import { clipText } from '../utils/pdfText.js';

function extractJsonBlock(text) {
  if (!text) {
    return null;
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1] ?? text;
  const firstBrace = source.indexOf('{');
  const lastBrace = source.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return source.slice(firstBrace, lastBrace + 1);
  }

  const firstBracket = source.indexOf('[');
  const lastBracket = source.lastIndexOf(']');

  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return source.slice(firstBracket, lastBracket + 1);
  }

  return null;
}

export function normalizeQuestions(questions) {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions
    .map((question, index) => {
      const questionText = question?.questionText ?? question?.question ?? '';
      const options = Array.isArray(question?.options) ? question.options.map((option) => String(option).trim()).filter(Boolean) : [];
      const uniqueOptions = [...new Set(options)].slice(0, 4);
      const correctAnswer = String(question?.correctAnswer ?? question?.correct_answer ?? '').trim();
      const matchedCorrect = uniqueOptions.find((option) => option.toLowerCase() === correctAnswer.toLowerCase()) ?? uniqueOptions[0];

      if (!String(questionText).trim() || uniqueOptions.length < 2 || !matchedCorrect) {
        return null;
      }

      while (uniqueOptions.length < 4) {
        uniqueOptions.push(`Option ${uniqueOptions.length + 1}`);
      }

      return {
        questionText: String(questionText).trim(),
        options: uniqueOptions,
        correctAnswer: matchedCorrect,
        explanation: String(question?.explanation ?? '').trim() || null,
        difficulty: String(question?.difficulty ?? 'medium').trim() || 'medium',
        topic: String(question?.topic ?? '').trim() || null,
        questionOrder: Number.isInteger(question?.questionOrder) ? question.questionOrder : index + 1,
      };
    })
    .filter(Boolean);
}

function parseQuestionsFromText(generatedText) {
  const jsonText = extractJsonBlock(generatedText) || generatedText;

  try {
    const parsed = JSON.parse(jsonText);
    return normalizeQuestions(parsed.questions ?? parsed);
  } catch {
    return [];
  }
}

function uniqueSentences(text) {
  return (text || '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length >= 40 && sentence.length <= 220);
}

function buildLocalQuestions(materialText, questionCount) {
  const sentences = uniqueSentences(materialText);
  const count = Math.min(Math.max(Number(questionCount) || 5, 3), 10);

  if (sentences.length < 4) {
    return [];
  }

  return Array.from({ length: Math.min(count, sentences.length - 1) }, (_, index) => {
    const correct = sentences[index];
    const distractors = sentences.filter((_, sentenceIndex) => sentenceIndex !== index).slice(index, index + 3);
    const options = [correct, ...distractors].slice(0, 4);

    while (options.length < 4) {
      options.push(`This statement is not supported by the notes (${options.length + 1}).`);
    }

    return {
      questionText: 'According to the study material, which statement is correct?',
      options,
      correctAnswer: correct,
      explanation: 'This statement appears in the uploaded study material.',
      difficulty: 'medium',
      topic: 'Study material',
      questionOrder: index + 1,
    };
  });
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.huggingFaceToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function callHuggingFaceChat(systemPrompt, userPrompt, maxTokens = 1800) {
  if (!env.huggingFaceToken) {
    const error = new Error('HUGGINGFACE_TOKEN is not configured on the server.');
    error.statusCode = 500;
    throw error;
  }

  const modelsToTry = [...new Set([env.huggingFaceModel, `${env.huggingFaceModel.replace(/:(cheapest|fastest|preferred)$/, '')}:cheapest`])];
  let lastError = null;

  for (const model of modelsToTry) {
    const { response, payload } = await postJson('https://router.huggingface.co/v1/chat/completions', {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
    });

    if (response.ok) {
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) {
        return content;
      }
    }

    lastError = payload?.error?.message || payload?.error || payload?.message || `Hugging Face API (${response.status})`;

    if (response.status === 401 || response.status === 403) {
      break;
    }
  }

  const legacyUrl = `https://api-inference.huggingface.co/models/${encodeURIComponent(env.huggingFaceModel)}`;
  const { response, payload } = await postJson(legacyUrl, {
    inputs: `${systemPrompt}\n\n${userPrompt}`,
    parameters: {
      max_new_tokens: maxTokens,
      temperature: 0.3,
      return_full_text: false,
    },
    options: {
      wait_for_model: true,
    },
  });

  if (response.ok) {
    if (Array.isArray(payload) && payload[0]?.generated_text) {
      return payload[0].generated_text;
    }

    if (typeof payload?.generated_text === 'string') {
      return payload.generated_text;
    }
  }

  const error = new Error(typeof lastError === 'string' ? lastError : 'Hugging Face API request failed.');
  error.statusCode = 502;
  throw error;
}

export async function generateQuizFromMaterial({ materialText, title, className, subjectName, questionCount = 5 }) {
  const clippedText = clipText(materialText);
  const count = Math.min(Math.max(Number(questionCount) || 5, 3), 10);

  if (!clippedText) {
    const error = new Error('This PDF has no extractable text. Upload a text-based PDF, not a scanned image.');
    error.statusCode = 400;
    throw error;
  }

  const systemPrompt = 'You generate classroom quizzes. Return JSON only. No markdown.';
  const userPrompt = [
    'Return strict JSON in this shape:',
    '{"questions":[{"questionText":"...","options":["A","B","C","D"],"correctAnswer":"A","explanation":"...","difficulty":"easy|medium|hard","topic":"..."}]}',
    `Generate exactly ${count} multiple-choice questions from the study material.`,
    'Each question must have exactly 4 options.',
    'correctAnswer must exactly match one option.',
    'Keep language simple and suitable for South African high school learners.',
    `Title: ${title}`,
    `Class: ${className}`,
    `Subject: ${subjectName}`,
    '',
    'Study material:',
    clippedText,
  ].join('\n');

  try {
    const generatedText = await callHuggingFaceChat(systemPrompt, userPrompt);
    const questions = parseQuestionsFromText(generatedText);

    if (questions.length > 0) {
      return { questions, source: 'huggingface' };
    }
  } catch (error) {
    const localQuestions = buildLocalQuestions(clippedText, count);
    if (localQuestions.length > 0) {
      return { questions: localQuestions, source: 'local-fallback', warning: error.message };
    }

    throw error;
  }

  const localQuestions = buildLocalQuestions(clippedText, count);
  if (localQuestions.length > 0) {
    return {
      questions: localQuestions,
      source: 'local-fallback',
      warning: 'The AI service did not return valid questions, so a draft was built from the study material.',
    };
  }

  const error = new Error('The AI service did not return valid quiz questions. Please try again.');
  error.statusCode = 502;
  throw error;
}

export async function generateAnswerExplanation({ questionText, options, selectedAnswer, correctAnswer, materialText, topic }) {
  const clippedText = clipText(materialText, 6000);
  const systemPrompt = 'You explain quiz answers for high school learners. Return JSON only.';
  const userPrompt = [
    'Return strict JSON: {"explanation":"...","studySuggestion":"..."}',
    'Explain why the learner answer is incorrect and what the correct concept is.',
    'Keep the explanation short and supportive.',
    `Question: ${questionText}`,
    `Options: ${(options || []).join(' | ')}`,
    `Learner answer: ${selectedAnswer}`,
    `Correct answer: ${correctAnswer}`,
    topic ? `Topic: ${topic}` : '',
    '',
    'Study material excerpt:',
    clippedText || 'No extra study material was available.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const generatedText = await callHuggingFaceChat(systemPrompt, userPrompt, 500);
    const jsonText = extractJsonBlock(generatedText) || generatedText;
    const parsed = JSON.parse(jsonText);

    return {
      explanation: String(parsed.explanation || generatedText).trim(),
      studySuggestion: String(parsed.studySuggestion || parsed.study_suggestion || '').trim() || `Review the notes on ${topic || 'this topic'}.`,
      source: 'huggingface',
    };
  } catch {
    return {
      explanation: `The selected answer "${selectedAnswer}" is not correct. The correct answer is "${correctAnswer}". Review the related section in your study material and compare each option against the key idea in the question.`,
      studySuggestion: topic ? `Review your notes on ${topic} and try a similar practice question.` : 'Review the matching section in the uploaded study material.',
      source: 'local-fallback',
    };
  }
}
