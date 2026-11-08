import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Always load server/.env (not cwd), and override any shell/OS copy of the token
// so updating HUGGINGFACE_TOKEN takes effect after a server restart.
const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');
dotenv.config({ path: envPath, override: true });

const clientOrigins = (process.env.CLIENT_ORIGINS ?? process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  clientOrigins,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  bootstrapAdminKey: process.env.BOOTSTRAP_ADMIN_KEY ?? '',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpTlsRejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? '',
  // AI provider: gemini | groq | huggingface | auto
  aiProvider: String(process.env.AI_PROVIDER || 'auto').trim().toLowerCase(),
  geminiApiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite',
  geminiFallbackModels: (process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-2.5-flash-lite')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean),
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  groqModel: process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant',
  groqFallbackModels: (process.env.GROQ_FALLBACK_MODELS ?? 'llama-3.3-70b-versatile,llama-3.1-8b-instant')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean),
  huggingFaceToken: process.env.HUGGINGFACE_TOKEN ?? process.env.HF_TOKEN ?? '',
  huggingFaceModel: process.env.HUGGINGFACE_MODEL ?? 'meta-llama/Llama-3.1-8B-Instruct',
  huggingFaceFallbackModels: (process.env.HUGGINGFACE_FALLBACK_MODELS
    ?? 'meta-llama/Llama-3.1-8B-Instruct,Qwen/Qwen2.5-7B-Instruct,google/gemma-3-4b-it')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean),
};
