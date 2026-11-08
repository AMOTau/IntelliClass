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

function smtpReady() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

function firstNameOf(fullName) {
  return String(fullName || 'there').trim().split(/\s+/)[0] || 'there';
}

function formatDate(value) {
  if (!value) {
    return 'no due date yet';
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return new Date(value).toDateString();
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toDateString();
}

function percentOf(score, maxScore) {
  const mark = Number(score);
  const outOf = Number(maxScore);
  if (!Number.isFinite(mark) || !Number.isFinite(outOf) || outOf <= 0) {
    return null;
  }
  return Math.round((mark / outOf) * 100);
}

export function describeResult(percent) {
  if (percent === null || percent === undefined || Number.isNaN(Number(percent))) {
    return 'I wanted you to hear this from me directly, rather than only through your child.';
  }
  const value = Number(percent);
  if (value >= 80) {
    return 'That is a strong result. Please do congratulate them — this kind of work is worth noticing at home.';
  }
  if (value >= 65) {
    return 'That is a solid result. A short recap of the parts they found harder will help the next piece of work land more easily.';
  }
  if (value >= 50) {
    return 'That is a fair result, but there is room to grow. Sitting with them for ten minutes on the weaker parts will make a real difference.';
  }
  return 'This one was difficult, and that is all right. Please do not scold them for the mark — encouragement and a little extra practice will help more than worry.';
}

function contactClosing(teacher = {}) {
  const name = teacher.name || 'your child\'s teacher';
  const lines = [
    `If you would like to talk this through, you are most welcome to contact me. I am happy to help, and no question is too small.`,
  ];
  if (teacher.phone) {
    lines.push(`You can reach me on ${teacher.phone}.`);
  }
  if (teacher.email) {
    lines.push(`You can also write to me at ${teacher.email}.`);
  }
  lines.push('', 'Warm regards,', name, teacher.subjectName ? `${teacher.subjectName} · IntelliClass` : 'IntelliClass');
  return lines;
}

function parentLetter({ parentName, childName, introduction, paragraphs, teacher }) {
  return [
    `Hello ${firstNameOf(parentName)},`,
    '',
    'I hope you are well.',
    '',
    introduction || `I am writing about ${childName}.`,
    '',
    ...paragraphs.flatMap((paragraph) => (paragraph ? [paragraph, ''] : [])),
    ...contactClosing(teacher),
  ];
}

async function sendPlainEmail({ to, subject, lines }) {
  const mailer = getTransporter();
  await mailer.sendMail({
    from: env.smtpFrom || env.smtpUser,
    to,
    subject,
    text: lines.filter((line) => line !== null && line !== undefined).join('\n'),
  });
}

async function sendParentLetter({ to, subject, parentName, childName, introduction, paragraphs, teacher }) {
  if (!smtpReady() || !to) {
    return;
  }

  await sendPlainEmail({
    to,
    subject,
    lines: parentLetter({ parentName, childName, introduction, paragraphs, teacher }),
  });
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
      'Warm regards,',
      'IntelliClass Team',
    ].join('\n'),
  });
}

export async function sendHomeworkAssignedEmail({
  to, fullName, childName, homeworkTitle, subjectName, className, dueDate, maxScore, teacher,
}) {
  await sendParentLetter({
    to,
    subject: `New homework for ${childName}: ${homeworkTitle}`,
    parentName: fullName,
    childName,
    introduction: `I have given ${childName} new homework${subjectName ? ` in ${subjectName}` : ''}.`,
    paragraphs: [
      `The task is “${homeworkTitle}”. It is due on ${formatDate(dueDate)}${maxScore ? `, and it will be marked out of ${maxScore}` : ''}.`,
      className ? `${childName} is doing this with ${className}.` : null,
      'Please check in with them so they can plan the evening around it. You can follow whether it is done, late, or marked when you sign in to IntelliClass.',
    ],
    teacher: { ...teacher, subjectName },
  });
}

export async function sendHomeworkCompletedEmail({
  to, fullName, childName, homeworkTitle, subjectName, dueDate, teacher,
}) {
  await sendParentLetter({
    to,
    subject: `${childName} has completed “${homeworkTitle}”`,
    parentName: fullName,
    childName,
    introduction: `A quick note to let you know that ${childName} has marked their homework as done.`,
    paragraphs: [
      `The homework is “${homeworkTitle}”${subjectName ? ` (${subjectName})` : ''}. It was due on ${formatDate(dueDate)}.`,
      'I still need to look at the work and enter a mark. You will hear from me again once it has been marked — please do not worry if the score is not there yet.',
    ],
    teacher: { ...teacher, subjectName },
  });
}

export async function sendHomeworkGradedEmail({
  to, fullName, childName, homeworkTitle, subjectName, score, maxScore, feedback, teacher,
}) {
  const percent = percentOf(score, maxScore);
  await sendParentLetter({
    to,
    subject: `${childName}'s homework has been marked: ${homeworkTitle}`,
    parentName: fullName,
    childName,
    introduction: `I have marked ${childName}'s homework, and I wanted you to hear how it went from me.`,
    paragraphs: [
      `The homework was “${homeworkTitle}”${subjectName ? ` in ${subjectName}` : ''}. ${childName} scored ${score} out of ${maxScore}${percent !== null ? ` (${percent}%)` : ''}.`,
      describeResult(percent),
      feedback ? `A note from me: ${feedback}` : 'There is no extra comment this time — the mark above is the main thing to talk about at home.',
      'You can open IntelliClass to see this alongside their other homework. If you would like me to set a short practice task, just say.',
    ],
    teacher: { ...teacher, subjectName },
  });
}

export async function sendQuizPublishedEmail({
  to, fullName, childName, quizTitle, className, subjectName, dueDate, teacher,
}) {
  await sendParentLetter({
    to,
    subject: `A new quiz is ready for ${childName}: ${quizTitle}`,
    parentName: fullName,
    childName,
    introduction: `I have published a new quiz for ${childName}'s class.`,
    paragraphs: [
      `The quiz is “${quizTitle}”${subjectName ? ` in ${subjectName}` : ''}${className ? `, for ${className}` : ''}.`,
      dueDate ? `Please encourage ${childName} to complete it by ${formatDate(dueDate)}.` : null,
      `${childName} can take it from their IntelliClass dashboard. You will be able to view the questions and, once they have finished, review their answers with them. Parents cannot take the quiz on the child's behalf — that keeps the mark honest.`,
    ].filter(Boolean),
    teacher: { ...teacher, subjectName },
  });
}

export async function sendQuizCompletedEmail({
  to, fullName, childName, quizTitle, subjectName, score, correctCount, totalQuestions, teacher,
}) {
  await sendParentLetter({
    to,
    subject: `${childName} has finished the quiz “${quizTitle}”`,
    parentName: fullName,
    childName,
    introduction: `${childName} has just completed a quiz, and I wanted you to see the result.`,
    paragraphs: [
      `The quiz was “${quizTitle}”${subjectName ? ` in ${subjectName}` : ''}. ${childName} scored ${score}%${correctCount != null && totalQuestions ? ` (${correctCount} out of ${totalQuestions} questions)` : ''}.`,
      describeResult(score),
      'When you sign in, choose Review next to this quiz. You can sit with them, look at the questions they missed, and talk it through — without sitting the test yourself.',
    ],
    teacher: { ...teacher, subjectName },
  });
}

export async function sendReportPublishedEmail({
  to, fullName, childName, reportTitle, periodLabel, quizAverage, homeworkCompletion, teacher,
}) {
  await sendParentLetter({
    to,
    subject: `${childName}'s ${periodLabel || 'term'} report is ready`,
    parentName: fullName,
    childName,
    introduction: `${childName}'s ${periodLabel || 'term'} report is now ready for you to read on IntelliClass.`,
    paragraphs: [
      `The report is titled “${reportTitle}”. It is a snapshot of the work they have done in this period, so later marks will not change what you see today.`,
      [
        quizAverage === null || quizAverage === undefined ? null : `Quiz average: ${quizAverage}%`,
        homeworkCompletion === null || homeworkCompletion === undefined ? null : `Homework completed: ${homeworkCompletion}%`,
      ].filter(Boolean).join('\n') || null,
      'Please sit with them and go through it. The school will still send the official report home — this copy is so you can see how they are doing without waiting for the envelope.',
    ],
    teacher,
  });
}

export async function sendParentMessageEmail({
  to, fullName, childName, title, body, teacher,
}) {
  await sendParentLetter({
    to,
    subject: `A note from ${teacher?.name || 'your child\'s teacher'} about ${childName}`,
    parentName: fullName,
    childName,
    introduction: `I wanted to write to you personally about ${childName}.`,
    paragraphs: [
      title ? `Subject: ${title}` : null,
      body,
      'You will also see this note as an alert when you open IntelliClass, so you can come back to it later.',
    ],
    teacher,
  });
}

/** @deprecated Use sendQuizPublishedEmail — kept so older call sites still compile while they are updated. */
export async function sendQuizNotificationEmail(options) {
  return sendQuizPublishedEmail(options);
}
