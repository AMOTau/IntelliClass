import dotenv from 'dotenv';

dotenv.config();

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
  huggingFaceToken: process.env.HUGGINGFACE_TOKEN ?? process.env.HF_TOKEN ?? '',
  huggingFaceModel: process.env.HUGGINGFACE_MODEL ?? 'mistralai/Mistral-7B-Instruct-v0.3',
};
