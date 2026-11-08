import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { env } from '../config/env.js';
import {
  generateAnswerExplanation,
  generateQuiz,
  normalizeLearnerTemplate,
  normalizeQuestions,
} from '../services/ai.js';
import { ensureFullMaterialText, getMaterialChapters } from '../services/quizAi/knowledgeBase.js';
import { loadHistory, recordGenerationExchange } from '../services/quizAi/conversationHistory.js';
import { normalizeDifficultyMix } from '../services/quizAi/systemInstructions.js';
import { quizClassInsights } from '../services/insights.js';
import { sendQuizCompletedEmail, sendQuizPublishedEmail } from '../utils/email.js';
import { deliver, parentsOfClass, parentsOfLearner, teacherContact } from '../utils/notify.js';

export const quizzesRouter = Router();
export const aiRouter = Router();

async function replaceQuizQuestions(client, quizId, questions) {
  await client.query('DELETE FROM quiz_explanations WHERE quiz_id = $1', [quizId]);
  await client.query('DELETE FROM questions WHERE quiz_id = $1', [quizId]);

  for (const question of questions) {
    await client.query(
      `INSERT INTO questions (quiz_id, question_text, options, correct_answer, explanation, difficulty, topic, question_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        quizId,
        question.questionText,
        JSON.stringify(question.options),
        question.correctAnswer,
        question.explanation,
        question.difficulty,
        question.topic,
        question.questionOrder,
      ]
    );
  }
}

function parseOptions(options) {
  if (Array.isArray(options)) {
    return options;
  }

  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function mapQuestion(question, { revealAnswers = false } = {}) {
  const payload = {
    id: question.id,
    questionText: question.question_text ?? question.questionText,
    options: parseOptions(question.options),
    questionOrder: question.question_order ?? question.questionOrder,
    topic: question.topic ?? null,
    difficulty: question.difficulty ?? null,
  };

  if (revealAnswers) {
    payload.correctAnswer = question.correct_answer ?? question.correctAnswer;
    payload.explanation = question.explanation ?? null;
  }

  return payload;
}

function normalizeDueDate(value) {
  if (value == null || value === '') {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${value.getUTCFullYear()}-${month}-${day}`;
  }
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function parseDueDateInput(value, { required = false } = {}) {
  if (value == null || value === '') {
    if (required) {
      const error = new Error('dueDate is required (YYYY-MM-DD).');
      error.statusCode = 400;
      throw error;
    }
    return null;
  }
  const dueDate = normalizeDueDate(value);
  if (!dueDate) {
    const error = new Error('dueDate must be a calendar date (YYYY-MM-DD).');
    error.statusCode = 400;
    throw error;
  }
  return dueDate;
}

function isQuizPastDue(dueDate) {
  const key = normalizeDueDate(dueDate);
  if (!key) {
    return false;
  }
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return key < today;
}

function buildQuizSummary(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    learnerTemplate: normalizeLearnerTemplate(row.learner_template),
    dueDate: normalizeDueDate(row.due_date),
    classId: row.class_id,
    className: row.class_name,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    materialId: row.material_id,
    materialTitle: row.material_title,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    questionCount: Number(row.question_count ?? 0),
    submissionCount: row.submission_count == null ? undefined : Number(row.submission_count),
    averageScore: row.average_score == null ? undefined : Number(Number(row.average_score).toFixed(1)),
    pastDue: isQuizPastDue(row.due_date),
    submission: row.score == null
      ? null
      : {
          score: Number(row.score),
          submittedAt: row.submitted_at,
        },
  };
}

async function notifyParentsForQuiz({ classId, quizTitle, subjectName, className, teacherId, dueDate }) {
  if (!classId) {
    return;
  }

  const recipients = await parentsOfClass(classId);
  const teacher = await teacherContact(teacherId);
  await deliver(recipients.map((recipient) => sendQuizPublishedEmail({
    to: recipient.email,
    fullName: recipient.fullName,
    childName: recipient.childName,
    quizTitle,
    className: className || 'the class',
    subjectName: subjectName || '',
    dueDate: dueDate || null,
    teacher: { ...teacher, subjectName },
  })));
}

async function loadMaterialForTeacher(materialId, teacherId, allowAdmin = false) {
  const materialResult = await pool.query(
    `SELECT id, teacher_id, title, extracted_text, file_path, class_name, subject, class_id, subject_id
     FROM materials
     WHERE id = $1`,
    [materialId]
  );

  if (materialResult.rowCount === 0) {
    const error = new Error('Material not found.');
    error.statusCode = 404;
    throw error;
  }

  if (!allowAdmin && materialResult.rows[0].teacher_id !== teacherId) {
    const error = new Error('You do not have permission to use this material.');
    error.statusCode = 403;
    throw error;
  }

  return materialResult.rows[0];
}

async function getQuizAccessList(user) {
  if (user.role === 'teacher' || user.role === 'admin') {
    const queryResult = await pool.query(
      `SELECT q.id, q.title, q.status, q.learner_template, q.due_date, q.class_id, c.name AS class_name, q.subject_id, s.name AS subject_name,
              q.material_id, m.title AS material_title, q.created_by, q.created_at, q.updated_at,
              COUNT(DISTINCT ques.id) AS question_count,
              COUNT(DISTINCT qs.id) AS submission_count,
              AVG(qs.score) AS average_score
       FROM quizzes q
       LEFT JOIN classes c ON c.id = q.class_id
       LEFT JOIN subjects s ON s.id = q.subject_id
       LEFT JOIN materials m ON m.id = q.material_id
       LEFT JOIN questions ques ON ques.quiz_id = q.id
       LEFT JOIN quiz_submissions qs ON qs.quiz_id = q.id
       ${user.role === 'admin' ? '' : 'WHERE q.created_by = $1'}
       GROUP BY q.id, q.title, q.status, q.learner_template, q.due_date, q.class_id, c.name, q.subject_id, s.name, q.material_id, m.title, q.created_by, q.created_at, q.updated_at
       ORDER BY q.due_date ASC NULLS LAST, q.created_at DESC`,
      user.role === 'admin' ? [] : [user.sub]
    );

    return queryResult.rows.map(buildQuizSummary);
  }

  if (user.role === 'learner') {
    const queryResult = await pool.query(
      `WITH learner_classes AS (
         SELECT class_id
         FROM class_learners
         WHERE learner_id = $1
       )
       SELECT q.id, q.title, q.status, q.learner_template, q.due_date, q.class_id, c.name AS class_name, q.subject_id, s.name AS subject_name,
              q.material_id, m.title AS material_title, q.created_by, q.created_at, q.updated_at,
              COUNT(ques.id) AS question_count,
              qs.score, qs.submitted_at
       FROM quizzes q
       JOIN learner_classes lc ON lc.class_id = q.class_id
       LEFT JOIN classes c ON c.id = q.class_id
       LEFT JOIN subjects s ON s.id = q.subject_id
       LEFT JOIN materials m ON m.id = q.material_id
       LEFT JOIN questions ques ON ques.quiz_id = q.id
       LEFT JOIN quiz_submissions qs ON qs.quiz_id = q.id AND qs.learner_id = $1
       WHERE q.status = 'published'
       GROUP BY q.id, q.title, q.status, q.learner_template, q.due_date, q.class_id, c.name, q.subject_id, s.name, q.material_id, m.title, q.created_by, q.created_at, q.updated_at, qs.score, qs.submitted_at
       ORDER BY q.due_date ASC NULLS LAST, q.created_at DESC`,
      [user.sub]
    );

    return queryResult.rows.map(buildQuizSummary);
  }

  return [];
}

async function fetchQuizForUser(quizId, user, { learnerId } = {}) {
  const quizResult = await pool.query(
    `SELECT q.id, q.title, q.status, q.learner_template, q.due_date, q.class_id, c.name AS class_name, c.grade_level, c.academic_year,
            q.subject_id, s.name AS subject_name, q.material_id, m.title AS material_title,
            q.source_scope, q.difficulty_mix, q.created_by, q.created_at, q.updated_at,
            t.first_name AS teacher_first_name, t.last_name AS teacher_last_name
     FROM quizzes q
     LEFT JOIN classes c ON c.id = q.class_id
     LEFT JOIN subjects s ON s.id = q.subject_id
     LEFT JOIN materials m ON m.id = q.material_id
     LEFT JOIN users t ON t.id = q.created_by
     WHERE q.id = $1`,
    [quizId]
  );

  if (quizResult.rowCount === 0) {
    const error = new Error('Quiz not found.');
    error.statusCode = 404;
    throw error;
  }

  const quiz = quizResult.rows[0];
  const canManage = user.role === 'admin' || quiz.created_by === user.sub;

  if (quiz.status !== 'published' && !canManage) {
    const error = new Error('You do not have permission to view this quiz.');
    error.statusCode = 403;
    throw error;
  }

  let reviewLearner = null;

  if (user.role === 'learner') {
    const classAccess = await pool.query(
      `SELECT 1 FROM class_learners WHERE learner_id = $1 AND class_id = $2`,
      [user.sub, quiz.class_id]
    );

    if (quiz.status !== 'published' || classAccess.rowCount === 0) {
      const error = new Error('This quiz is not available for your classes.');
      error.statusCode = 403;
      throw error;
    }
  }

  if (user.role === 'parent') {
    if (quiz.status !== 'published') {
      const error = new Error('This quiz is not available to view yet.');
      error.statusCode = 403;
      throw error;
    }

    if (!learnerId) {
      const error = new Error('Choose which child you want to review.');
      error.statusCode = 400;
      throw error;
    }

    const childAccess = await pool.query(
      `SELECT u.id, u.first_name, u.last_name
       FROM parent_learners pl
       JOIN users u ON u.id = pl.learner_id
       JOIN class_learners cl ON cl.learner_id = pl.learner_id
       WHERE pl.parent_id = $1 AND pl.learner_id = $2 AND cl.class_id = $3`,
      [user.sub, learnerId, quiz.class_id]
    );

    if (childAccess.rowCount === 0) {
      const error = new Error('You can only view quizzes for your own children.');
      error.statusCode = 403;
      throw error;
    }

    reviewLearner = childAccess.rows[0];
  }

  if (canManage && learnerId) {
    const learnerResult = await pool.query(
      `SELECT u.id, u.first_name, u.last_name
       FROM users u
       JOIN quiz_submissions qs ON qs.learner_id = u.id AND qs.quiz_id = $1
       WHERE u.id = $2`,
      [quizId, learnerId]
    );
    if (learnerResult.rowCount === 0) {
      const error = new Error('That learner has not submitted this quiz yet.');
      error.statusCode = 404;
      throw error;
    }
    reviewLearner = learnerResult.rows[0];
  }

  if (!canManage && user.role !== 'learner' && user.role !== 'parent') {
    const error = new Error('You do not have permission to view this quiz.');
    error.statusCode = 403;
    throw error;
  }

  const questionsResult = await pool.query(
    `SELECT id, question_text, options, correct_answer, explanation, difficulty, topic, question_order, created_at
     FROM questions
     WHERE quiz_id = $1
     ORDER BY question_order ASC, created_at ASC`,
    [quizId]
  );

  let submission = null;
  const submissionLearnerId = reviewLearner?.id
    || (user.role === 'learner' ? user.sub : null);
  if (submissionLearnerId) {
    const submissionResult = await pool.query(
      `SELECT id, answers, total_questions, correct_count, score, submitted_at
       FROM quiz_submissions
       WHERE quiz_id = $1 AND learner_id = $2`,
      [quizId, submissionLearnerId]
    );
    submission = submissionResult.rows[0] ?? null;
  }

  return {
    quiz,
    questions: questionsResult.rows,
    canManage,
    submission,
    reviewLearner,
  };
}

function buildQuestionResults(questions, answers) {
  const answerMap = new Map();

  if (Array.isArray(answers)) {
    answers.forEach((entry) => {
      if (entry?.questionId) {
        answerMap.set(entry.questionId, entry.answer);
      }
    });
  } else if (answers && typeof answers === 'object') {
    Object.entries(answers).forEach(([questionId, answer]) => answerMap.set(questionId, answer));
  }

  return questions.map((question) => {
    const selectedAnswer = String(answerMap.get(question.id) ?? '').trim();
    const correctAnswer = String(question.correct_answer).trim();
    const isCorrect = selectedAnswer === correctAnswer;

    return {
      questionId: question.id,
      questionText: question.question_text,
      options: parseOptions(question.options),
      selectedAnswer,
      correctAnswer,
      isCorrect,
      explanation: question.explanation,
      topic: question.topic,
    };
  });
}

async function createQuizRecord(client, {
  createdBy,
  title,
  classId,
  subjectId,
  materialId,
  status,
  learnerTemplate,
  questions,
  sourceScope = null,
  difficultyMix = null,
  dueDate = null,
}) {
  const quizResult = await client.query(
    `INSERT INTO quizzes (created_by, title, class_id, subject_id, material_id, status, learner_template, source_scope, difficulty_mix, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, title, status, learner_template, due_date, class_id, subject_id, material_id, source_scope, difficulty_mix, created_by, created_at, updated_at`,
    [
      createdBy,
      title,
      classId ?? null,
      subjectId ?? null,
      materialId ?? null,
      status,
      normalizeLearnerTemplate(learnerTemplate),
      sourceScope ? JSON.stringify(sourceScope) : null,
      difficultyMix,
      dueDate,
    ]
  );

  const quiz = quizResult.rows[0];

  for (const question of questions) {
    await client.query(
      `INSERT INTO questions (quiz_id, question_text, options, correct_answer, explanation, difficulty, topic, question_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        quiz.id,
        question.questionText,
        JSON.stringify(question.options),
        question.correctAnswer,
        question.explanation,
        question.difficulty,
        question.topic,
        question.questionOrder,
      ]
    );
  }

  return quiz;
}

const MAX_SCOPE_MATERIALS = 6;

// Turns a request body or stored quiz scope into
// [{ materialId, chapterIds }] (what we persist) and the loaded scope the AI uses.
function normalizeScopeRequest({ materialIds, materialId, chapterSelection }) {
  const ids = [...new Set((Array.isArray(materialIds) && materialIds.length ? materialIds : [materialId]).filter(Boolean))]
    .slice(0, MAX_SCOPE_MATERIALS);
  const selection = chapterSelection && typeof chapterSelection === 'object' ? chapterSelection : {};
  return ids.map((id) => ({
    materialId: id,
    chapterIds: Array.isArray(selection[id]) ? selection[id].map(String).slice(0, 60) : [],
  }));
}

async function loadScope(scopeRecord, user, { skipMissing = false } = {}) {
  const loaded = [];
  for (const entry of scopeRecord) {
    try {
      const material = await loadMaterialForTeacher(entry.materialId, user.sub, user.role === 'admin');
      const chapters = await getMaterialChapters(material);
      loaded.push({ material, chapters, chapterIds: entry.chapterIds });
    } catch (error) {
      if (!skipMissing || error.statusCode !== 404) {
        throw error;
      }
    }
  }

  if (loaded.length === 0) {
    const error = new Error('None of the selected study materials are available any more. Upload or choose another material.');
    error.statusCode = 400;
    throw error;
  }

  return {
    scope: loaded,
    record: loaded.map(({ material, chapterIds }) => ({ materialId: material.id, chapterIds })),
  };
}

function storedScopeFor(quiz) {
  if (Array.isArray(quiz.source_scope) && quiz.source_scope.length) {
    return quiz.source_scope;
  }
  return quiz.material_id ? [{ materialId: quiz.material_id, chapterIds: [] }] : [];
}

function buildManagedQuizPayload(payload) {
  return {
    id: payload.quiz.id,
    title: payload.quiz.title,
    status: payload.quiz.status,
    learnerTemplate: normalizeLearnerTemplate(payload.quiz.learner_template),
    dueDate: normalizeDueDate(payload.quiz.due_date),
    pastDue: isQuizPastDue(payload.quiz.due_date),
    classId: payload.quiz.class_id,
    className: payload.quiz.class_name,
    subjectId: payload.quiz.subject_id,
    subjectName: payload.quiz.subject_name,
    materialId: payload.quiz.material_id,
    materialTitle: payload.quiz.material_title,
    sourceScope: storedScopeFor(payload.quiz),
    difficultyMix: normalizeDifficultyMix(payload.quiz.difficulty_mix),
    createdBy: payload.quiz.created_by,
    createdAt: payload.quiz.created_at,
    updatedAt: payload.quiz.updated_at,
    questions: payload.questions.map((question) => mapQuestion(question, { revealAnswers: true })),
  };
}

function generationSummary(generation) {
  return {
    source: generation.source,
    model: generation.model || null,
    warning: generation.warning || null,
    plan: generation.plan.map(({ key, label, count }) => ({ key, label, count })),
    scopeDescription: generation.scopeDescription,
  };
}

aiRouter.get('/health', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  const { activeProvider, activeProviderId } = await import('../services/quizAi/llmClient.js');
  const provider = activeProvider();
  const models = provider.models();
  return res.json({
    status: 'ok',
    provider: activeProviderId(),
    providerName: provider.name,
    tokenConfigured: Boolean(provider.token()),
    model: models[0] || null,
  });
});

aiRouter.post('/generate-quiz', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  let client = null;

  try {
    const {
      title,
      classId,
      subjectId,
      questionCount = 8,
      learnerTemplate = 'classic',
      difficultyMix = 'balanced',
      instructions = '',
      dueDate,
    } = req.body;
    const resolvedDueDate = parseDueDateInput(dueDate);

    const scopeRequest = normalizeScopeRequest(req.body);
    if (scopeRequest.length === 0) {
      return res.status(400).json({ message: 'Choose at least one study material.' });
    }

    const { scope, record } = await loadScope(scopeRequest, req.user);
    const material = scope[0].material;
    const resolvedClassId = classId || material.class_id;
    const resolvedSubjectId = subjectId || material.subject_id;

    if (!resolvedClassId || !resolvedSubjectId) {
      return res.status(400).json({ message: 'classId and subjectId are required.' });
    }

    const classResult = await pool.query('SELECT id, name FROM classes WHERE id = $1', [resolvedClassId]);
    if (classResult.rowCount === 0) {
      return res.status(404).json({ message: 'classId does not exist.' });
    }

    const subjectResult = await pool.query('SELECT id, name FROM subjects WHERE id = $1', [resolvedSubjectId]);
    if (subjectResult.rowCount === 0) {
      return res.status(404).json({ message: 'subjectId does not exist.' });
    }

    const template = normalizeLearnerTemplate(learnerTemplate);
    const mix = normalizeDifficultyMix(difficultyMix);
    const teacherInstructions = String(instructions || '').trim().slice(0, 1500);

    const generation = await generateQuiz({
      scope,
      className: classResult.rows[0].name,
      subjectName: subjectResult.rows[0].name,
      questionCount,
      learnerTemplate: template,
      difficultyMix: mix,
      instructions: teacherInstructions,
    });

    client = await pool.connect();
    await client.query('BEGIN');

    const quiz = await createQuizRecord(client, {
      createdBy: req.user.sub,
      title: title?.trim() || `${material.title} Quiz`,
      classId: resolvedClassId,
      subjectId: resolvedSubjectId,
      materialId: material.id,
      status: 'draft',
      learnerTemplate: template,
      questions: generation.questions,
      sourceScope: record,
      difficultyMix: mix,
      dueDate: resolvedDueDate,
    });

    await recordGenerationExchange(client, {
      quizId: quiz.id,
      teacherId: req.user.sub,
      request: {
        instructions: teacherInstructions,
        mode: 'create',
        questionCount: generation.questions.length,
        difficultyMix: mix,
        learnerTemplate: template,
        scope: record,
        scopeDescription: generation.scopeDescription,
      },
      result: generation,
    });

    await client.query('COMMIT');

    const created = await fetchQuizForUser(quiz.id, req.user);
    return res.status(201).json({
      quiz: buildManagedQuizPayload(created),
      ...generationSummary(generation),
    });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // no-op
      }
    }

    return next(error);
  } finally {
    client?.release();
  }
});

aiRouter.post('/regenerate-quiz', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  let client = null;

  try {
    const { quizId, questionCount, instructions = '', difficultyMix } = req.body;
    const mode = req.body.mode === 'append' ? 'append' : 'replace';
    if (!quizId) {
      return res.status(400).json({ message: 'quizId is required.' });
    }

    const payload = await fetchQuizForUser(quizId, req.user);
    if (!payload.canManage) {
      return res.status(403).json({ message: 'You do not have permission to regenerate this quiz.' });
    }

    const requestedScope = req.body.materialIds?.length ? normalizeScopeRequest(req.body) : storedScopeFor(payload.quiz);
    if (requestedScope.length === 0) {
      return res.status(400).json({ message: 'This quiz has no linked study material to generate from.' });
    }

    const { scope, record } = await loadScope(requestedScope, req.user, { skipMissing: true });
    const mix = normalizeDifficultyMix(difficultyMix || payload.quiz.difficulty_mix);
    const template = normalizeLearnerTemplate(payload.quiz.learner_template);
    const teacherInstructions = String(instructions || '').trim().slice(0, 1500);
    const existingQuestions = payload.questions.map((question) => mapQuestion(question, { revealAnswers: true }));
    const count = Number(questionCount) || (mode === 'append' ? 3 : existingQuestions.length || 8);
    const history = await loadHistory(payload.quiz.id);

    const generation = await generateQuiz({
      scope,
      className: payload.quiz.class_name || '',
      subjectName: payload.quiz.subject_name || '',
      questionCount: count,
      learnerTemplate: template,
      difficultyMix: mix,
      instructions: teacherInstructions,
      history,
      existingQuestions,
      mode,
    });

    const nextQuestions = (mode === 'append' ? [...existingQuestions, ...generation.questions] : generation.questions)
      .map((question, index) => ({ ...question, questionOrder: index + 1 }));

    client = await pool.connect();
    await client.query('BEGIN');
    await replaceQuizQuestions(client, payload.quiz.id, nextQuestions);
    await client.query(
      `UPDATE quizzes SET source_scope = $1, difficulty_mix = $2, material_id = $3, updated_at = now() WHERE id = $4`,
      [JSON.stringify(record), mix, record[0].materialId, payload.quiz.id]
    );
    await recordGenerationExchange(client, {
      quizId: payload.quiz.id,
      teacherId: req.user.sub,
      request: {
        instructions: teacherInstructions,
        mode,
        questionCount: count,
        difficultyMix: mix,
        learnerTemplate: template,
        scope: record,
        scopeDescription: generation.scopeDescription,
      },
      result: generation,
    });
    await client.query('COMMIT');

    const updated = await fetchQuizForUser(payload.quiz.id, req.user);
    return res.json({
      quiz: buildManagedQuizPayload(updated),
      mode,
      addedCount: generation.questions.length,
      ...generationSummary(generation),
    });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // no-op
      }
    }
    return next(error);
  } finally {
    client?.release();
  }
});

aiRouter.get('/quiz-history/:quizId', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const payload = await fetchQuizForUser(req.params.quizId, req.user);
    if (!payload.canManage) {
      return res.status(403).json({ message: 'You do not have permission to view this quiz history.' });
    }

    const history = await loadHistory(payload.quiz.id);
    return res.json({
      quizId: payload.quiz.id,
      sourceScope: storedScopeFor(payload.quiz),
      difficultyMix: normalizeDifficultyMix(payload.quiz.difficulty_mix),
      history: history.map((turn) => ({
        id: String(turn.id),
        role: turn.role,
        content: turn.content,
        createdAt: turn.createdAt,
        mode: turn.metadata.mode || null,
        questionCount: turn.metadata.questionCount ?? null,
        difficultyMix: turn.metadata.difficultyMix || null,
        scopeDescription: turn.metadata.scopeDescription || null,
        source: turn.metadata.source || null,
        warning: turn.metadata.warning || null,
        questions: turn.metadata.questions || [],
      })),
    });
  } catch (error) {
    return next(error);
  }
});

aiRouter.post('/explain-answer', requireAuth, requireRole('learner'), async (req, res, next) => {
  try {
    const { quizId, questionId } = req.body;
    const enrichWithAi = Boolean(req.body?.enrichWithAi);

    if (!quizId || !questionId) {
      return res.status(400).json({ message: 'quizId and questionId are required.' });
    }

    const payload = await fetchQuizForUser(quizId, req.user);
    if (!payload.submission) {
      return res.status(400).json({ message: 'Submit the quiz before requesting an explanation.' });
    }

    const question = payload.questions.find((item) => item.id === questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found.' });
    }

    const results = buildQuestionResults(payload.questions, payload.submission.answers);
    const questionResult = results.find((item) => item.questionId === questionId);

    if (!questionResult || questionResult.isCorrect) {
      return res.status(400).json({ message: 'Explanations are only available for incorrect answers.' });
    }

    // Cached AI explanations only when asking for the richer tutor tip.
    if (enrichWithAi) {
      const existing = await pool.query(
        `SELECT explanation, study_suggestion
         FROM quiz_explanations
         WHERE quiz_id = $1 AND question_id = $2 AND learner_id = $3`,
        [quizId, questionId, req.user.sub]
      );

      if (existing.rowCount > 0) {
        return res.json({
          explanation: existing.rows[0].explanation,
          studySuggestion: existing.rows[0].study_suggestion,
          source: 'cached',
        });
      }
    }

    let materialText = '';
    if (enrichWithAi) {
      const materialIds = storedScopeFor(payload.quiz).map((entry) => entry.materialId);
      if (materialIds.length) {
        const materialResult = await pool.query(
          'SELECT id, extracted_text, file_path FROM materials WHERE id = ANY($1::uuid[])',
          [materialIds]
        );
        // Prefer already-extracted text; skip slow PDF re-parse for explanations.
        materialText = materialResult.rows.map((material) => material.extracted_text || '').filter(Boolean).join('\n\n');
        if (!materialText) {
          const texts = await Promise.all(materialResult.rows.map((material) => ensureFullMaterialText(material)));
          materialText = texts.filter(Boolean).join('\n\n');
        }
      }
    }

    const generated = await generateAnswerExplanation({
      questionText: question.question_text,
      options: parseOptions(question.options),
      selectedAnswer: questionResult.selectedAnswer,
      correctAnswer: questionResult.correctAnswer,
      materialText,
      topic: question.topic,
      storedExplanation: question.explanation || '',
      enrichWithAi,
    });

    if (enrichWithAi && generated.source === 'ai') {
      await pool.query(
        `INSERT INTO quiz_explanations (quiz_id, question_id, learner_id, explanation, study_suggestion)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (quiz_id, question_id, learner_id)
         DO UPDATE SET explanation = EXCLUDED.explanation, study_suggestion = EXCLUDED.study_suggestion`,
        [quizId, questionId, req.user.sub, generated.explanation, generated.studySuggestion]
      );
    }

    return res.json({
      explanation: generated.explanation,
      studySuggestion: generated.studySuggestion,
      source: generated.source,
    });
  } catch (error) {
    return next(error);
  }
});

quizzesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const quizzes = await getQuizAccessList(req.user);
    return res.json({ quizzes });
  } catch (error) {
    return next(error);
  }
});

quizzesRouter.post('/create', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { title, classId, subjectId, materialId, questions, status = 'draft', learnerTemplate = 'classic', dueDate } = req.body;
    const normalizedQuestions = normalizeQuestions(questions);
    const resolvedDueDate = parseDueDateInput(dueDate);

    if (normalizedQuestions.length === 0) {
      return res.status(400).json({ message: 'Provide at least one valid question.' });
    }

    if (!classId || !subjectId) {
      return res.status(400).json({ message: 'classId and subjectId are required.' });
    }

    await client.query('BEGIN');
    const quizRow = await createQuizRecord(client, {
      createdBy: req.user.sub,
      title: title?.trim() || 'Untitled Quiz',
      classId,
      subjectId,
      materialId,
      status: status === 'published' ? 'draft' : status,
      learnerTemplate,
      questions: normalizedQuestions,
      dueDate: resolvedDueDate,
    });
    await client.query('COMMIT');

    const quizPayload = await fetchQuizForUser(quizRow.id, req.user);
    return res.status(201).json({
      quiz: {
        ...quizRow,
        learnerTemplate: normalizeLearnerTemplate(quizRow.learner_template),
        dueDate: normalizeDueDate(quizRow.due_date),
        questions: quizPayload.questions.map((question) => mapQuestion(question, { revealAnswers: true })),
      },
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // no-op
    }

    return next(error);
  } finally {
    client.release();
  }
});

quizzesRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const payload = await fetchQuizForUser(req.params.id, req.user, {
      learnerId: req.query.learnerId,
    });
    const revealAnswers = payload.canManage || Boolean(payload.submission);

    return res.json({
      quiz: {
        id: payload.quiz.id,
        title: payload.quiz.title,
        status: payload.quiz.status,
        learnerTemplate: normalizeLearnerTemplate(payload.quiz.learner_template),
        dueDate: normalizeDueDate(payload.quiz.due_date),
        pastDue: isQuizPastDue(payload.quiz.due_date),
        classId: payload.quiz.class_id,
        className: payload.quiz.class_name,
        subjectId: payload.quiz.subject_id,
        subjectName: payload.quiz.subject_name,
        materialId: payload.quiz.material_id,
        materialTitle: payload.quiz.material_title,
        ...(payload.canManage
          ? { sourceScope: storedScopeFor(payload.quiz), difficultyMix: normalizeDifficultyMix(payload.quiz.difficulty_mix) }
          : {}),
        createdBy: payload.quiz.created_by,
        teacherName: [payload.quiz.teacher_first_name, payload.quiz.teacher_last_name].filter(Boolean).join(' ').trim() || null,
        createdAt: payload.quiz.created_at,
        updatedAt: payload.quiz.updated_at,
        reviewLearner: payload.reviewLearner
          ? {
              id: payload.reviewLearner.id,
              firstName: payload.reviewLearner.first_name,
              lastName: payload.reviewLearner.last_name,
            }
          : null,
        questions: payload.questions.map((question) => mapQuestion(question, { revealAnswers })),
        submission: payload.submission
          ? {
              id: payload.submission.id,
              score: Number(payload.submission.score),
              correctCount: payload.submission.correct_count,
              totalQuestions: payload.submission.total_questions,
              submittedAt: payload.submission.submitted_at,
              results: buildQuestionResults(payload.questions, payload.submission.answers),
            }
          : null,
      },
    });
  } catch (error) {
    return next(error);
  }
});

quizzesRouter.get('/:id/results', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const payload = await fetchQuizForUser(req.params.id, req.user);
    if (!payload.canManage) {
      return res.status(403).json({ message: 'You do not have permission to view these results.' });
    }

    const insights = await quizClassInsights(payload.quiz.id);
    return res.json(insights);
  } catch (error) {
    return next(error);
  }
});

quizzesRouter.put('/:id', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  const client = await pool.connect();

  try {
    const payload = await fetchQuizForUser(req.params.id, req.user);
    if (!payload.canManage) {
      return res.status(403).json({ message: 'You do not have permission to edit this quiz.' });
    }

    const { title, questions, learnerTemplate, dueDate } = req.body;
    const normalizedQuestions = normalizeQuestions(questions);

    if (normalizedQuestions.length === 0) {
      return res.status(400).json({ message: 'Provide at least one valid question.' });
    }

    const nextTemplate = learnerTemplate
      ? normalizeLearnerTemplate(learnerTemplate)
      : normalizeLearnerTemplate(payload.quiz.learner_template);
    const nextDueDate = Object.prototype.hasOwnProperty.call(req.body, 'dueDate')
      ? parseDueDateInput(dueDate)
      : normalizeDueDate(payload.quiz.due_date);

    await client.query('BEGIN');
    await client.query(
      `UPDATE quizzes
       SET title = COALESCE($1, title),
           learner_template = $2,
           due_date = $3,
           updated_at = now()
       WHERE id = $4`,
      [title?.trim() || null, nextTemplate, nextDueDate, payload.quiz.id]
    );
    await replaceQuizQuestions(client, payload.quiz.id, normalizedQuestions);
    await client.query('COMMIT');
    const updated = await fetchQuizForUser(payload.quiz.id, req.user);

    return res.json({
      quiz: {
        id: updated.quiz.id,
        title: updated.quiz.title,
        status: updated.quiz.status,
        learnerTemplate: normalizeLearnerTemplate(updated.quiz.learner_template),
        dueDate: normalizeDueDate(updated.quiz.due_date),
        pastDue: isQuizPastDue(updated.quiz.due_date),
        classId: updated.quiz.class_id,
        className: updated.quiz.class_name,
        subjectId: updated.quiz.subject_id,
        subjectName: updated.quiz.subject_name,
        materialId: updated.quiz.material_id,
        materialTitle: updated.quiz.material_title,
        createdBy: updated.quiz.created_by,
        createdAt: updated.quiz.created_at,
        updatedAt: updated.quiz.updated_at,
        questions: updated.questions.map((question) => mapQuestion(question, { revealAnswers: true })),
      },
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // no-op
    }

    return next(error);
  } finally {
    client.release();
  }
});

quizzesRouter.delete('/:id', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const payload = await fetchQuizForUser(req.params.id, req.user);
    if (!payload.canManage) {
      return res.status(403).json({ message: 'You do not have permission to delete this quiz.' });
    }

    await pool.query('DELETE FROM quizzes WHERE id = $1', [payload.quiz.id]);
    return res.json({ message: 'Quiz deleted.', id: payload.quiz.id });
  } catch (error) {
    return next(error);
  }
});

quizzesRouter.post('/:id/publish', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const payload = await fetchQuizForUser(req.params.id, req.user);
    if (!payload.canManage) {
      return res.status(403).json({ message: 'You do not have permission to publish this quiz.' });
    }

    if (payload.questions.length === 0) {
      return res.status(400).json({ message: 'Add at least one question before publishing.' });
    }

    const updatedQuiz = await pool.query(
      `UPDATE quizzes
       SET status = 'published', updated_at = now()
       WHERE id = $1
       RETURNING id, title, status, learner_template, class_id, subject_id, material_id, created_by, created_at, updated_at`,
      [payload.quiz.id]
    );

    // Don't block publish on SMTP — email is best-effort.
    void notifyParentsForQuiz({
      classId: payload.quiz.class_id,
      quizTitle: payload.quiz.title,
      subjectName: payload.quiz.subject_name || '',
      className: payload.quiz.class_name || '',
      teacherId: payload.quiz.created_by,
      dueDate: normalizeDueDate(payload.quiz.due_date),
    }).catch((error) => {
      console.warn('Quiz publish email notification failed:', error?.message || error);
    });

    return res.json({
      quiz: {
        ...updatedQuiz.rows[0],
        learnerTemplate: normalizeLearnerTemplate(updatedQuiz.rows[0].learner_template),
        dueDate: normalizeDueDate(payload.quiz.due_date),
        pastDue: isQuizPastDue(payload.quiz.due_date),
        className: payload.quiz.class_name,
        subjectName: payload.quiz.subject_name,
        questions: payload.questions.map((question) => mapQuestion(question, { revealAnswers: true })),
      },
    });
  } catch (error) {
    return next(error);
  }
});

quizzesRouter.post('/:id/submit', requireAuth, requireRole('learner'), async (req, res, next) => {
  try {
    const quizPayload = await fetchQuizForUser(req.params.id, req.user);
    if (quizPayload.quiz.status !== 'published') {
      return res.status(400).json({ message: 'This quiz is not open for submission.' });
    }

    if (isQuizPastDue(quizPayload.quiz.due_date)) {
      return res.status(400).json({ message: 'This quiz is past its due date and can no longer be submitted.' });
    }

    if (quizPayload.submission) {
      return res.status(400).json({ message: 'You have already submitted this quiz.' });
    }

    const answers = req.body.answers;
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ message: 'answers are required.' });
    }

    const results = buildQuestionResults(quizPayload.questions, answers);
    const correctCount = results.filter((result) => result.isCorrect).length;
    const totalQuestions = quizPayload.questions.length;
    const score = totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 100).toFixed(2)) : 0;
    const normalizedAnswers = results.map((result) => ({ questionId: result.questionId, answer: result.selectedAnswer }));

    const upsertResult = await pool.query(
      `INSERT INTO quiz_submissions (quiz_id, learner_id, answers, total_questions, correct_count, score)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, quiz_id, learner_id, answers, total_questions, correct_count, score, submitted_at, created_at, updated_at`,
      [req.params.id, req.user.sub, JSON.stringify(normalizedAnswers), totalQuestions, correctCount, score]
    );

    const recipients = await parentsOfLearner(req.user.sub);
    const teacher = await teacherContact(quizPayload.quiz.created_by);
    const child = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [req.user.sub]);
    const childName = child.rows[0] ? `${child.rows[0].first_name} ${child.rows[0].last_name}`.trim() : 'your child';
    await deliver(recipients.map((recipient) => sendQuizCompletedEmail({
      to: recipient.email,
      fullName: recipient.fullName,
      childName: recipient.childName || childName,
      quizTitle: quizPayload.quiz.title,
      subjectName: quizPayload.quiz.subject_name,
      score,
      correctCount,
      totalQuestions,
      teacher: { ...teacher, subjectName: quizPayload.quiz.subject_name },
    })));

    return res.status(201).json({
      submission: upsertResult.rows[0],
      score,
      correctCount,
      totalQuestions,
      results,
    });
  } catch (error) {
    return next(error);
  }
});
