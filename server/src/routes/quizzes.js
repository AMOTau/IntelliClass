import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { generateAnswerExplanation, generateQuizFromMaterial, normalizeQuestions } from '../services/ai.js';
import { sendQuizNotificationEmail } from '../utils/email.js';

export const quizzesRouter = Router();
export const aiRouter = Router();

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

function buildQuizSummary(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
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
    submission: row.score == null
      ? null
      : {
          score: Number(row.score),
          submittedAt: row.submitted_at,
        },
  };
}

async function notifyParentsForQuiz({ classId, quizTitle, subjectName, className }) {
  if (!classId) {
    return;
  }

  try {
    const parentResult = await pool.query(
      `SELECT DISTINCT u.id, u.first_name, u.last_name, u.email
       FROM users u
       JOIN parent_learners pl ON pl.parent_id = u.id
       JOIN class_learners cl ON cl.learner_id = pl.learner_id
       WHERE cl.class_id = $1`,
      [classId]
    );

    await Promise.allSettled(
      parentResult.rows.map((parent) =>
        sendQuizNotificationEmail({
          to: parent.email,
          fullName: `${parent.first_name} ${parent.last_name}`,
          quizTitle,
          className: className || 'the class',
          subjectName: subjectName || '',
        })
      )
    );
  } catch {
    // Email is optional for the quiz lifecycle.
  }
}

async function loadMaterialForTeacher(materialId, teacherId, allowAdmin = false) {
  const materialResult = await pool.query(
    `SELECT id, teacher_id, title, extracted_text, class_name, subject, class_id, subject_id
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
      `SELECT q.id, q.title, q.status, q.class_id, c.name AS class_name, q.subject_id, s.name AS subject_name,
              q.material_id, m.title AS material_title, q.created_by, q.created_at, q.updated_at,
              COUNT(ques.id) AS question_count
       FROM quizzes q
       LEFT JOIN classes c ON c.id = q.class_id
       LEFT JOIN subjects s ON s.id = q.subject_id
       LEFT JOIN materials m ON m.id = q.material_id
       LEFT JOIN questions ques ON ques.quiz_id = q.id
       ${user.role === 'admin' ? '' : 'WHERE q.created_by = $1'}
       GROUP BY q.id, q.title, q.status, q.class_id, c.name, q.subject_id, s.name, q.material_id, m.title, q.created_by, q.created_at, q.updated_at
       ORDER BY q.created_at DESC`,
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
       SELECT q.id, q.title, q.status, q.class_id, c.name AS class_name, q.subject_id, s.name AS subject_name,
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
       GROUP BY q.id, q.title, q.status, q.class_id, c.name, q.subject_id, s.name, q.material_id, m.title, q.created_by, q.created_at, q.updated_at, qs.score, qs.submitted_at
       ORDER BY q.created_at DESC`,
      [user.sub]
    );

    return queryResult.rows.map(buildQuizSummary);
  }

  return [];
}

async function fetchQuizForUser(quizId, user) {
  const quizResult = await pool.query(
    `SELECT q.id, q.title, q.status, q.class_id, c.name AS class_name, c.grade_level, c.academic_year,
            q.subject_id, s.name AS subject_name, q.material_id, m.title AS material_title,
            q.created_by, q.created_at, q.updated_at
     FROM quizzes q
     LEFT JOIN classes c ON c.id = q.class_id
     LEFT JOIN subjects s ON s.id = q.subject_id
     LEFT JOIN materials m ON m.id = q.material_id
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

  const questionsResult = await pool.query(
    `SELECT id, question_text, options, correct_answer, explanation, difficulty, topic, question_order, created_at
     FROM questions
     WHERE quiz_id = $1
     ORDER BY question_order ASC, created_at ASC`,
    [quizId]
  );

  let submission = null;
  if (user.role === 'learner') {
    const submissionResult = await pool.query(
      `SELECT id, answers, total_questions, correct_count, score, submitted_at
       FROM quiz_submissions
       WHERE quiz_id = $1 AND learner_id = $2`,
      [quizId, user.sub]
    );
    submission = submissionResult.rows[0] ?? null;
  }

  return {
    quiz,
    questions: questionsResult.rows,
    canManage,
    submission,
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

async function createQuizRecord(client, { createdBy, title, classId, subjectId, materialId, status, questions }) {
  const quizResult = await client.query(
    `INSERT INTO quizzes (created_by, title, class_id, subject_id, material_id, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, status, class_id, subject_id, material_id, created_by, created_at, updated_at`,
    [createdBy, title, classId ?? null, subjectId ?? null, materialId ?? null, status]
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

aiRouter.get('/health', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  return res.json({
    status: 'ok',
    tokenConfigured: Boolean(env.huggingFaceToken),
    model: env.huggingFaceModel,
  });
});

aiRouter.post('/generate-quiz', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { materialId, title, classId, subjectId, questionCount = 5 } = req.body;

    if (!materialId) {
      return res.status(400).json({ message: 'materialId is required.' });
    }

    const material = await loadMaterialForTeacher(materialId, req.user.sub, req.user.role === 'admin');
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

    const generation = await generateQuizFromMaterial({
      materialText: material.extracted_text,
      title: title?.trim() || material.title,
      className: classResult.rows[0].name,
      subjectName: subjectResult.rows[0].name,
      questionCount,
    });

    await client.query('BEGIN');

    const quiz = await createQuizRecord(client, {
      createdBy: req.user.sub,
      title: title?.trim() || `${material.title} Quiz`,
      classId: resolvedClassId,
      subjectId: resolvedSubjectId,
      materialId,
      status: 'draft',
      questions: generation.questions,
    });

    await client.query('COMMIT');

    const storedQuestions = await pool.query(
      `SELECT id, question_text, options, correct_answer, explanation, difficulty, topic, question_order
       FROM questions WHERE quiz_id = $1 ORDER BY question_order ASC`,
      [quiz.id]
    );

    return res.status(201).json({
      quiz: {
        ...quiz,
        className: classResult.rows[0].name,
        subjectName: subjectResult.rows[0].name,
        questions: storedQuestions.rows.map((question) => mapQuestion(question, { revealAnswers: true })),
      },
      source: generation.source,
      warning: generation.warning || null,
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

aiRouter.post('/explain-answer', requireAuth, requireRole('learner'), async (req, res, next) => {
  try {
    const { quizId, questionId } = req.body;

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
      });
    }

    let materialText = '';
    if (payload.quiz.material_id) {
      const materialResult = await pool.query('SELECT extracted_text FROM materials WHERE id = $1', [payload.quiz.material_id]);
      materialText = materialResult.rows[0]?.extracted_text || '';
    }

    const generated = await generateAnswerExplanation({
      questionText: question.question_text,
      options: parseOptions(question.options),
      selectedAnswer: questionResult.selectedAnswer,
      correctAnswer: questionResult.correctAnswer,
      materialText,
      topic: question.topic,
    });

    await pool.query(
      `INSERT INTO quiz_explanations (quiz_id, question_id, learner_id, explanation, study_suggestion)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (quiz_id, question_id, learner_id)
       DO UPDATE SET explanation = EXCLUDED.explanation, study_suggestion = EXCLUDED.study_suggestion`,
      [quizId, questionId, req.user.sub, generated.explanation, generated.studySuggestion]
    );

    return res.json({
      explanation: generated.explanation,
      studySuggestion: generated.studySuggestion,
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
    const { title, classId, subjectId, materialId, questions, status = 'draft' } = req.body;
    const normalizedQuestions = normalizeQuestions(questions);

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
      questions: normalizedQuestions,
    });
    await client.query('COMMIT');

    const quizPayload = await fetchQuizForUser(quizRow.id, req.user);
    return res.status(201).json({
      quiz: {
        ...quizRow,
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
    const payload = await fetchQuizForUser(req.params.id, req.user);
    const revealAnswers = payload.canManage || Boolean(payload.submission);

    return res.json({
      quiz: {
        id: payload.quiz.id,
        title: payload.quiz.title,
        status: payload.quiz.status,
        classId: payload.quiz.class_id,
        className: payload.quiz.class_name,
        subjectId: payload.quiz.subject_id,
        subjectName: payload.quiz.subject_name,
        materialId: payload.quiz.material_id,
        materialTitle: payload.quiz.material_title,
        createdBy: payload.quiz.created_by,
        createdAt: payload.quiz.created_at,
        updatedAt: payload.quiz.updated_at,
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

quizzesRouter.put('/:id', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  const client = await pool.connect();

  try {
    const payload = await fetchQuizForUser(req.params.id, req.user);
    if (!payload.canManage) {
      return res.status(403).json({ message: 'You do not have permission to edit this quiz.' });
    }

    if (payload.quiz.status === 'published') {
      return res.status(400).json({ message: 'Published quizzes cannot be edited. Archive it first if you need changes.' });
    }

    const { title, questions } = req.body;
    const normalizedQuestions = normalizeQuestions(questions);

    if (normalizedQuestions.length === 0) {
      return res.status(400).json({ message: 'Provide at least one valid question.' });
    }

    await client.query('BEGIN');
    await client.query(
      `UPDATE quizzes SET title = COALESCE($1, title), updated_at = now() WHERE id = $2`,
      [title?.trim() || null, payload.quiz.id]
    );
    await client.query('DELETE FROM questions WHERE quiz_id = $1', [payload.quiz.id]);

    for (const question of normalizedQuestions) {
      await client.query(
        `INSERT INTO questions (quiz_id, question_text, options, correct_answer, explanation, difficulty, topic, question_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          payload.quiz.id,
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

    await client.query('COMMIT');
    const updated = await fetchQuizForUser(payload.quiz.id, req.user);

    return res.json({
      quiz: {
        ...updated.quiz,
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
       RETURNING id, title, status, class_id, subject_id, material_id, created_by, created_at, updated_at`,
      [payload.quiz.id]
    );

    await notifyParentsForQuiz({
      classId: payload.quiz.class_id,
      quizTitle: payload.quiz.title,
      subjectName: payload.quiz.subject_name || '',
      className: payload.quiz.class_name || '',
    });

    return res.json({
      quiz: {
        ...updatedQuiz.rows[0],
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
