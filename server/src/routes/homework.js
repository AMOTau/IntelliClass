import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendHomeworkAssignedEmail, sendHomeworkCompletedEmail, sendHomeworkGradedEmail } from '../utils/email.js';
import { deliver, parentsOfClass, parentsOfLearner, teacherContact } from '../utils/notify.js';

export const homeworkRouter = Router();

const DEFAULT_MAX_SCORE = 10;

function mapHomework(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subject: row.subject,
    className: row.class_name,
    classId: row.class_id,
    subjectId: row.subject_id,
    dueDate: row.due_date,
    maxScore: row.max_score === null || row.max_score === undefined ? null : Number(row.max_score),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedCount: row.submitted_count === undefined ? undefined : Number(row.submitted_count),
    gradedCount: row.graded_count === undefined ? undefined : Number(row.graded_count),
    learnerCount: row.learner_count === undefined ? undefined : Number(row.learner_count),
  };
}

function parseMaxScore(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_MAX_SCORE;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1000 ? parsed : DEFAULT_MAX_SCORE;
}

async function loadHomeworkForTeacher(homeworkId, user) {
  const result = await pool.query(
    `SELECT h.id, h.teacher_id, h.title, h.description, h.subject, h.class_name, h.class_id, h.subject_id,
            h.due_date, h.max_score, h.created_at, h.updated_at
     FROM homework h
     WHERE h.id = $1`,
    [homeworkId]
  );

  if (result.rowCount === 0) {
    const error = new Error('Homework not found.');
    error.statusCode = 404;
    throw error;
  }

  if (user.role !== 'admin' && result.rows[0].teacher_id !== user.sub) {
    const error = new Error('You do not have permission to manage this homework.');
    error.statusCode = 403;
    throw error;
  }

  return result.rows[0];
}

homeworkRouter.get('/', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT h.id, h.title, h.description, h.subject, h.class_name, h.class_id, h.subject_id,
              h.due_date, h.max_score, h.created_at, h.updated_at,
              COUNT(DISTINCT cl.learner_id) AS learner_count,
              COUNT(DISTINCT sub.learner_id) AS submitted_count,
              COUNT(DISTINCT sub.learner_id) FILTER (WHERE sub.score IS NOT NULL) AS graded_count
       FROM homework h
       LEFT JOIN class_learners cl ON cl.class_id = h.class_id
       LEFT JOIN submissions sub ON sub.homework_id = h.id
       WHERE h.teacher_id = $1 OR $2 = 'admin'
       GROUP BY h.id
       ORDER BY h.due_date ASC NULLS LAST, h.created_at DESC`,
      [req.user.sub, req.user.role]
    );

    return res.json({ homework: result.rows.map(mapHomework) });
  } catch (error) {
    return next(error);
  }
});

homeworkRouter.post('/', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const classId = req.body.classId;
    const subjectId = req.body.subjectId;
    const dueDate = String(req.body.dueDate || '').trim();
    const maxScore = parseMaxScore(req.body.maxScore);

    if (!title) {
      return res.status(400).json({ message: 'A homework title is required.' });
    }

    if (!classId || !subjectId) {
      return res.status(400).json({ message: 'Choose a class and a subject.' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return res.status(400).json({ message: 'Choose a due date.' });
    }

    const assignment = await pool.query(
      `SELECT c.name AS class_name, s.name AS subject_name
       FROM class_subject_teachers cst
       JOIN classes c ON c.id = cst.class_id
       JOIN subjects s ON s.id = cst.subject_id
       WHERE cst.teacher_id = $1 AND cst.class_id = $2 AND cst.subject_id = $3`,
      [req.user.sub, classId, subjectId]
    );

    if (req.user.role !== 'admin' && assignment.rowCount === 0) {
      return res.status(403).json({ message: 'You are not assigned to that class and subject.' });
    }

    let className = assignment.rows[0]?.class_name;
    let subjectName = assignment.rows[0]?.subject_name;

    if (!className || !subjectName) {
      const classResult = await pool.query('SELECT name FROM classes WHERE id = $1', [classId]);
      const subjectResult = await pool.query('SELECT name FROM subjects WHERE id = $1', [subjectId]);
      if (classResult.rowCount === 0 || subjectResult.rowCount === 0) {
        return res.status(404).json({ message: 'Class or subject was not found.' });
      }
      className = classResult.rows[0].name;
      subjectName = subjectResult.rows[0].name;
    }

    const created = await pool.query(
      `INSERT INTO homework (teacher_id, title, description, subject, class_name, class_id, subject_id, due_date, max_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, description, subject, class_name, class_id, subject_id, due_date, max_score, created_at, updated_at`,
      [req.user.sub, title, description || null, subjectName, className, classId, subjectId, dueDate, maxScore]
    );

    const homework = mapHomework(created.rows[0]);
    const recipients = await parentsOfClass(classId);
    const teacher = await teacherContact(req.user.sub);
    await deliver(recipients.map((recipient) => sendHomeworkAssignedEmail({
      to: recipient.email,
      fullName: recipient.fullName,
      childName: recipient.childName,
      homeworkTitle: homework.title,
      subjectName,
      className,
      dueDate: homework.dueDate,
      maxScore: homework.maxScore,
      teacher: { ...teacher, subjectName },
    })));

    return res.status(201).json({ homework, notifiedParents: recipients.length });
  } catch (error) {
    return next(error);
  }
});

// Class roster for marking: every learner in the class, submitted or not.
homeworkRouter.get('/:id/submissions', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const homework = await loadHomeworkForTeacher(req.params.id, req.user);

    const result = await pool.query(
      `SELECT u.id AS learner_id, u.first_name, u.last_name,
              sub.id AS submission_id, sub.status, sub.submitted_at, sub.score, sub.feedback, sub.graded_at
       FROM class_learners cl
       JOIN users u ON u.id = cl.learner_id
       LEFT JOIN submissions sub ON sub.homework_id = $1 AND sub.learner_id = cl.learner_id
       WHERE cl.class_id = $2
       ORDER BY u.first_name ASC, u.last_name ASC`,
      [homework.id, homework.class_id]
    );

    return res.json({
      homework: mapHomework(homework),
      submissions: result.rows.map((row) => ({
        learnerId: row.learner_id,
        learnerName: `${row.first_name} ${row.last_name}`.trim(),
        submissionId: row.submission_id,
        status: row.submission_id ? row.status : 'not_submitted',
        submittedAt: row.submitted_at,
        score: row.score === null ? null : Number(row.score),
        feedback: row.feedback,
        gradedAt: row.graded_at,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

// Marking a learner who never pressed "done" still records the mark, so a zero
// for missing work is possible.
homeworkRouter.post('/:id/grade', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const homework = await loadHomeworkForTeacher(req.params.id, req.user);
    const learnerId = req.body.learnerId;
    const feedback = String(req.body.feedback || '').trim() || null;
    const maxScore = Number(homework.max_score) || DEFAULT_MAX_SCORE;

    if (!learnerId) {
      return res.status(400).json({ message: 'learnerId is required.' });
    }

    const score = Number(req.body.score);
    if (!Number.isFinite(score) || score < 0 || score > maxScore) {
      return res.status(400).json({ message: `Enter a mark between 0 and ${maxScore}.` });
    }

    const enrolled = await pool.query(
      'SELECT 1 FROM class_learners WHERE learner_id = $1 AND class_id = $2',
      [learnerId, homework.class_id]
    );

    if (enrolled.rowCount === 0) {
      return res.status(400).json({ message: 'That learner is not in this class.' });
    }

    const saved = await pool.query(
      `INSERT INTO submissions (homework_id, learner_id, status, content, score, feedback, graded_at, graded_by)
       VALUES ($1, $2, 'submitted', 'Marked by teacher', $3, $4, now(), $5)
       ON CONFLICT (homework_id, learner_id)
       DO UPDATE SET score = EXCLUDED.score,
                     feedback = EXCLUDED.feedback,
                     graded_at = now(),
                     graded_by = EXCLUDED.graded_by,
                     updated_at = now()
       RETURNING id, learner_id, status, submitted_at, score, feedback, graded_at`,
      [homework.id, learnerId, score, feedback, req.user.sub]
    );

    const recipients = await parentsOfLearner(learnerId);
    const teacher = await teacherContact(req.user.sub);
    await deliver(recipients.map((recipient) => sendHomeworkGradedEmail({
      to: recipient.email,
      fullName: recipient.fullName,
      childName: recipient.childName,
      homeworkTitle: homework.title,
      subjectName: homework.subject,
      score,
      maxScore,
      feedback,
      teacher: { ...teacher, subjectName: homework.subject },
    })));

    const row = saved.rows[0];
    return res.json({
      submission: {
        learnerId: row.learner_id,
        status: row.status,
        submittedAt: row.submitted_at,
        score: Number(row.score),
        feedback: row.feedback,
        gradedAt: row.graded_at,
      },
      notifiedParents: recipients.length,
    });
  } catch (error) {
    return next(error);
  }
});

homeworkRouter.delete('/:id', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM homework
       WHERE id = $1 AND (teacher_id = $2 OR $3 = 'admin')
       RETURNING id`,
      [req.params.id, req.user.sub, req.user.role]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Homework not found.' });
    }

    return res.json({ message: 'Homework deleted.' });
  } catch (error) {
    return next(error);
  }
});

homeworkRouter.post('/:id/complete', requireAuth, requireRole('learner'), async (req, res, next) => {
  try {
    const access = await pool.query(
      `SELECT h.id, h.title, h.subject, h.due_date, h.teacher_id, h.class_id, u.first_name, u.last_name
       FROM homework h
       JOIN class_learners cl ON cl.learner_id = $2
       JOIN users u ON u.id = $2
       LEFT JOIN classes c ON c.id = cl.class_id
       WHERE h.id = $1
         AND (h.class_id = cl.class_id OR (h.class_id IS NULL AND h.class_name = c.name))`,
      [req.params.id, req.user.sub]
    );

    if (access.rowCount === 0) {
      return res.status(403).json({ message: 'This homework is not assigned to your class.' });
    }

    const homework = access.rows[0];
    const already = await pool.query(
      `SELECT status, score FROM submissions WHERE homework_id = $1 AND learner_id = $2`,
      [homework.id, req.user.sub]
    );
    const firstCompletion = already.rowCount === 0;

    const saved = await pool.query(
      `INSERT INTO submissions (homework_id, learner_id, status, content)
       VALUES ($1, $2, 'submitted', 'Marked complete by learner')
       ON CONFLICT (homework_id, learner_id)
       DO UPDATE SET status = 'submitted',
                     submitted_at = COALESCE(submissions.submitted_at, now()),
                     updated_at = now()
       RETURNING id, homework_id, learner_id, status, submitted_at, score, feedback`,
      [homework.id, req.user.sub]
    );

    if (firstCompletion) {
      const recipients = await parentsOfLearner(req.user.sub);
      const teacher = await teacherContact(homework.teacher_id);
      const childName = `${homework.first_name} ${homework.last_name}`.trim();
      await deliver(recipients.map((recipient) => sendHomeworkCompletedEmail({
        to: recipient.email,
        fullName: recipient.fullName,
        childName: recipient.childName || childName,
        homeworkTitle: homework.title,
        subjectName: homework.subject,
        dueDate: homework.due_date,
        teacher: { ...teacher, subjectName: homework.subject },
      })));
    }

    return res.json({ submission: saved.rows[0] });
  } catch (error) {
    return next(error);
  }
});
