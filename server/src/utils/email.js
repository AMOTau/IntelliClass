import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

function assertSmtpConfigured() {
  const requiredFields = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const missingFields = [];

  if (!env.smtpHost) {
    missingFields.push(requiredFields[0]);
  }

  if (!env.smtpUser) {
    missingFields.push(requiredFields[1]);
  }

  if (!env.smtpPass) {
    missingFields.push(requiredFields[2]);
  }

  if (missingFields.length > 0) {
    const error = new Error(`SMTP is not configured. Missing: ${missingFields.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }
}

let transporter;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  assertSmtpConfigured();

  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
    tls: {
      rejectUnauthorized: env.smtpTlsRejectUnauthorized,
    },
  });

  return transporter;
}

export async function sendCredentialsEmail({ to, fullName, role, email, password }) {
  const mailer = getTransporter();
  const fromAddress = env.smtpFrom || env.smtpUser;

  await mailer.sendMail({
    from: fromAddress,
    to,
    subject: 'Your IntelliClass account credentials',
    text: [
      `Hello ${fullName},`,
      '',
      `Your IntelliClass ${role} account has been created by the administrator.`,
      '',
      'Use these credentials to sign in:',
      `Email: ${email}`,
      `Password: ${password}`,
      '',
      'Please change your password after your first login.',
      '',
      'IntelliClass Team',
    ].join('\n'),
  });
}

export async function sendQuizNotificationEmail({ to, fullName, quizTitle, className, subjectName }) {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    return;
  }

  const mailer = getTransporter();
  const fromAddress = env.smtpFrom || env.smtpUser;

  await mailer.sendMail({
    from: fromAddress,
    to,
    subject: `New IntelliClass quiz: ${quizTitle}`,
    text: [
      `Hello ${fullName},`,
      '',
      `A new quiz has been published for ${className || 'your learner\'s class'}.`,
      subjectName ? `Subject: ${subjectName}` : null,
      `Quiz: ${quizTitle}`,
      '',
      'Please check your learner dashboard for the updated quiz list.',
      '',
      'IntelliClass Team',
    ]
      .filter(Boolean)
      .join('\n'),
  });
}
