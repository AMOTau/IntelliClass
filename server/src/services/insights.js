// Progress analytics shared by the parent dashboard and term reports.
// Everything here is derived from data the system already stores: quiz
// submissions, the topic/difficulty tags the quiz AI writes onto questions,
// and homework submissions.
import { pool } from '../config/db.js';

const DIFFICULTY_LABELS = {
  easy: 'Simple',
  medium: 'Normal',
  hard: 'Hard',
  extreme: 'Extremely hard',
};

const MIN_TOPIC_QUESTIONS = 3;

function percentage(value) {
  return value === null || value === undefined ? null : Math.round(Number(value) * 10) / 10;
}

function ratio(correct, total) {
  return total > 0 ? Math.round((correct / total) * 1000) / 10 : null;
}

// Topics are stored as "Material › Chapter › Section". Parents care about the
// chapter, so collapse to that level and drop any leading numbering.
export function topicLabel(topic) {
  const parts = String(topic || '').split('›').map((part) => part.trim()).filter(Boolean);
  const chapter = parts.length > 1 ? parts[1] : parts[0] || '';
  return chapter
    .replace(/^\d+(\.\d+)*[.)]?\s*/, '')
    .replace(/\s*[—–-]\s*.*$/, '')
    .trim()
    .slice(0, 80) || 'General';
}

function dateParams(range) {
  return [range?.from ?? null, range?.to ?? null];
}

export async function quizPerformance(learnerId, range) {
  const [from, to] = dateParams(range);
  const result = await pool.query(
    `SELECT COUNT(*)::int AS attempts,
            AVG(qs.score) AS average,
            MIN(qs.score) AS lowest,
            MAX(qs.score) AS highest
     FROM quiz_submissions qs
     WHERE qs.learner_id = $1
       AND ($2::date IS NULL OR qs.submitted_at >= $2::date)
       AND ($3::date IS NULL OR qs.submitted_at < ($3::date + 1))`,
    [learnerId, from, to]
  );

  const row = result.rows[0];
  return {
    attempts: row.attempts,
    average: percentage(row.average),
    lowest: percentage(row.lowest),
    highest: percentage(row.highest),
  };
}

export async function homeworkPerformance(learnerId, range) {
  const [from, to] = dateParams(range);
  const result = await pool.query(
    `SELECT COUNT(DISTINCT h.id)::int AS assigned,
            COUNT(DISTINCT sub.homework_id) FILTER (WHERE sub.status IN ('submitted', 'late'))::int AS completed,
            COUNT(DISTINCT sub.homework_id) FILTER (WHERE sub.score IS NOT NULL)::int AS graded,
            AVG(sub.score / NULLIF(h.max_score, 0) * 100) AS average
     FROM homework h
     JOIN class_learners cl ON cl.class_id = h.class_id AND cl.learner_id = $1
     LEFT JOIN submissions sub ON sub.homework_id = h.id AND sub.learner_id = $1
     WHERE ($2::date IS NULL OR h.due_date >= $2::date)
       AND ($3::date IS NULL OR h.due_date <= $3::date)`,
    [learnerId, from, to]
  );

  const row = result.rows[0];
  return {
    assigned: row.assigned,
    completed: row.completed,
    graded: row.graded,
    outstanding: Math.max(0, row.assigned - row.completed),
    completionRate: ratio(row.completed, row.assigned),
    average: percentage(row.average),
  };
}

export async function subjectBreakdown(learnerId, range) {
  const [from, to] = dateParams(range);

  const quizResult = await pool.query(
    `SELECT s.id, s.name, COUNT(qs.id)::int AS attempts, AVG(qs.score) AS average
     FROM quiz_submissions qs
     JOIN quizzes qz ON qz.id = qs.quiz_id
     JOIN subjects s ON s.id = qz.subject_id
     WHERE qs.learner_id = $1
       AND ($2::date IS NULL OR qs.submitted_at >= $2::date)
       AND ($3::date IS NULL OR qs.submitted_at < ($3::date + 1))
     GROUP BY s.id, s.name`,
    [learnerId, from, to]
  );

  const homeworkResult = await pool.query(
    `SELECT s.id, s.name,
            COUNT(DISTINCT h.id)::int AS assigned,
            COUNT(DISTINCT sub.homework_id) FILTER (WHERE sub.status IN ('submitted', 'late'))::int AS completed,
            AVG(sub.score / NULLIF(h.max_score, 0) * 100) AS average
     FROM homework h
     JOIN class_learners cl ON cl.class_id = h.class_id AND cl.learner_id = $1
     JOIN subjects s ON s.id = h.subject_id
     LEFT JOIN submissions sub ON sub.homework_id = h.id AND sub.learner_id = $1
     WHERE ($2::date IS NULL OR h.due_date >= $2::date)
       AND ($3::date IS NULL OR h.due_date <= $3::date)
     GROUP BY s.id, s.name`,
    [learnerId, from, to]
  );

  const subjects = new Map();
  const ensure = (id, name) => {
    if (!subjects.has(id)) {
      subjects.set(id, {
        subjectId: id,
        subjectName: name,
        quizAttempts: 0,
        quizAverage: null,
        homeworkAssigned: 0,
        homeworkCompleted: 0,
        homeworkAverage: null,
      });
    }
    return subjects.get(id);
  };

  quizResult.rows.forEach((row) => {
    const entry = ensure(row.id, row.name);
    entry.quizAttempts = row.attempts;
    entry.quizAverage = percentage(row.average);
  });

  homeworkResult.rows.forEach((row) => {
    const entry = ensure(row.id, row.name);
    entry.homeworkAssigned = row.assigned;
    entry.homeworkCompleted = row.completed;
    entry.homeworkAverage = percentage(row.average);
  });

  return [...subjects.values()].sort((a, b) => a.subjectName.localeCompare(b.subjectName));
}

// Joins each stored answer back to its question so we can score per topic and
// per difficulty. q.id is compared as text because older answer rows are not
// guaranteed to hold valid uuids.
async function answerRows(learnerId, range) {
  const [from, to] = dateParams(range);
  const result = await pool.query(
    `SELECT q.topic, q.difficulty, s.name AS subject_name,
            (btrim(lower(a->>'answer')) = btrim(lower(q.correct_answer))) AS is_correct
     FROM quiz_submissions qs
     CROSS JOIN LATERAL jsonb_array_elements(qs.answers) AS a
     JOIN questions q ON q.id::text = a->>'questionId'
     JOIN quizzes qz ON qz.id = qs.quiz_id
     LEFT JOIN subjects s ON s.id = qz.subject_id
     WHERE qs.learner_id = $1
       AND jsonb_typeof(qs.answers) = 'array'
       AND ($2::date IS NULL OR qs.submitted_at >= $2::date)
       AND ($3::date IS NULL OR qs.submitted_at < ($3::date + 1))`,
    [learnerId, from, to]
  );

  return result.rows;
}

export async function topicBreakdown(learnerId, range, { limit = 5 } = {}) {
  const rows = await answerRows(learnerId, range);

  const topics = new Map();
  const difficulties = new Map();

  for (const row of rows) {
    if (row.topic && row.topic.trim()) {
      const label = topicLabel(row.topic);
      const entry = topics.get(label) || { topic: label, subjectName: row.subject_name || null, total: 0, correct: 0 };
      entry.total += 1;
      entry.correct += row.is_correct ? 1 : 0;
      topics.set(label, entry);
    }

    const key = row.difficulty || 'medium';
    const level = difficulties.get(key) || { key, label: DIFFICULTY_LABELS[key] || 'Normal', total: 0, correct: 0 };
    level.total += 1;
    level.correct += row.is_correct ? 1 : 0;
    difficulties.set(key, level);
  }

  const scored = [...topics.values()]
    .map((entry) => ({ ...entry, accuracy: ratio(entry.correct, entry.total) }))
    .filter((entry) => entry.total >= MIN_TOPIC_QUESTIONS);

  const byDifficulty = ['easy', 'medium', 'hard', 'extreme']
    .map((key) => difficulties.get(key))
    .filter(Boolean)
    .map((entry) => ({ ...entry, accuracy: ratio(entry.correct, entry.total) }));

  return {
    answeredQuestions: rows.length,
    strengths: [...scored].sort((a, b) => b.accuracy - a.accuracy || b.total - a.total).slice(0, limit),
    weaknesses: [...scored].sort((a, b) => a.accuracy - b.accuracy || b.total - a.total).slice(0, limit),
    byDifficulty,
  };
}

export async function buildLearnerSummary(learnerId, range) {
  const [quizzes, homework, subjects, topics] = await Promise.all([
    quizPerformance(learnerId, range),
    homeworkPerformance(learnerId, range),
    subjectBreakdown(learnerId, range),
    topicBreakdown(learnerId, range),
  ]);

  return { quizzes, homework, subjects, topics };
}

export async function quizClassInsights(quizId) {
  const [submissionsResult, pendingResult, topicResult, questionResult] = await Promise.all([
    pool.query(
      `SELECT u.id AS learner_id, u.first_name, u.last_name,
              qs.score, qs.correct_count, qs.total_questions, qs.submitted_at
       FROM quiz_submissions qs
       JOIN users u ON u.id = qs.learner_id
       WHERE qs.quiz_id = $1
       ORDER BY qs.score ASC, u.first_name ASC, u.last_name ASC`,
      [quizId]
    ),
    pool.query(
      `SELECT u.id AS learner_id, u.first_name, u.last_name
       FROM quizzes q
       JOIN class_learners cl ON cl.class_id = q.class_id
       JOIN users u ON u.id = cl.learner_id
       WHERE q.id = $1
         AND NOT EXISTS (
           SELECT 1 FROM quiz_submissions qs
           WHERE qs.quiz_id = q.id AND qs.learner_id = u.id
         )
       ORDER BY u.first_name ASC, u.last_name ASC`,
      [quizId]
    ),
    pool.query(
      `SELECT q.topic,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE btrim(lower(a->>'answer')) = btrim(lower(q.correct_answer)))::int AS correct
       FROM quiz_submissions qs
       CROSS JOIN LATERAL jsonb_array_elements(qs.answers) AS a
       JOIN questions q ON q.id::text = a->>'questionId'
       WHERE qs.quiz_id = $1
         AND jsonb_typeof(qs.answers) = 'array'
         AND q.topic IS NOT NULL
         AND btrim(q.topic) <> ''
       GROUP BY q.topic`,
      [quizId]
    ),
    pool.query(
      `SELECT q.id, q.question_text, q.topic, q.question_order,
              COUNT(qs.id)::int AS attempts,
              COUNT(*) FILTER (WHERE btrim(lower(a->>'answer')) = btrim(lower(q.correct_answer)))::int AS correct
       FROM questions q
       LEFT JOIN quiz_submissions qs ON qs.quiz_id = q.quiz_id AND jsonb_typeof(qs.answers) = 'array'
       LEFT JOIN LATERAL jsonb_array_elements(qs.answers) AS a ON a->>'questionId' = q.id::text
       WHERE q.quiz_id = $1
       GROUP BY q.id, q.question_text, q.topic, q.question_order
       ORDER BY q.question_order ASC`,
      [quizId]
    ),
  ]);

  const submissions = submissionsResult.rows.map((row) => ({
    learnerId: row.learner_id,
    firstName: row.first_name,
    lastName: row.last_name,
    score: Number(row.score),
    correctCount: Number(row.correct_count),
    totalQuestions: Number(row.total_questions),
    submittedAt: row.submitted_at,
  }));

  const pending = pendingResult.rows.map((row) => ({
    learnerId: row.learner_id,
    firstName: row.first_name,
    lastName: row.last_name,
  }));

  const topics = [...topicResult.rows.reduce((map, row) => {
    const label = topicLabel(row.topic);
    const current = map.get(label) || { topic: label, total: 0, correct: 0 };
    current.total += Number(row.total);
    current.correct += Number(row.correct);
    map.set(label, current);
    return map;
  }, new Map()).values()]
    .map((entry) => ({ ...entry, accuracy: ratio(entry.correct, entry.total) }))
    .filter((entry) => entry.total > 0);

  const questions = questionResult.rows.map((row) => {
    const attempts = Number(row.attempts) || 0;
    const correct = Number(row.correct) || 0;
    return {
      questionId: row.id,
      questionText: row.question_text,
      topic: topicLabel(row.topic),
      questionOrder: row.question_order,
      attempts,
      correct,
      missed: Math.max(0, attempts - correct),
      accuracy: ratio(correct, attempts),
    };
  }).filter((question) => question.attempts > 0);

  const averageScore = submissions.length
    ? Math.round((submissions.reduce((sum, row) => sum + row.score, 0) / submissions.length) * 10) / 10
    : null;

  return {
    summary: {
      submittedCount: submissions.length,
      pendingCount: pending.length,
      averageScore,
      lowestScore: submissions.length ? submissions[0].score : null,
      highestScore: submissions.length ? Math.max(...submissions.map((row) => row.score)) : null,
    },
    submissions,
    pending,
    strengths: [...topics].sort((a, b) => b.accuracy - a.accuracy || b.total - a.total).slice(0, 4),
    weaknesses: [...topics].sort((a, b) => a.accuracy - b.accuracy || b.total - a.total).slice(0, 4),
    questions: [...questions].sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100)).slice(0, 6),
  };
}
