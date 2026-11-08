import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { buildLearnerSummary } from '../services/insights.js';
import { sendReportPublishedEmail } from '../utils/email.js';
import { deliver, parentsOfLearner, teacherContact } from '../utils/notify.js';

export const reportsRouter = Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function mapReport(row, { includeSummary = true } = {}) {
  return {
    id: row.id,
    learnerId: row.learner_id,
    learnerName: row.first_name ? `${row.first_name} ${row.last_name}`.trim() : undefined,
    classId: row.class_id,
    className: row.class_name ?? undefined,
    title: row.title,
    periodLabel: row.period_label,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    comment: row.comment,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    summary: includeSummary ? row.summary ?? {} : undefined,
  };
}

async function teacherTeachesLearner(teacherId, learnerId) {
  const result = await pool.query(
    `SELECT 1
     FROM class_learners cl
     JOIN class_subject_teachers cst ON cst.class_id = cl.class_id
     WHERE cl.learner_id = $1 AND cst.teacher_id = $2
     LIMIT 1`,
    [learnerId, teacherId]
  );
  return result.rowCount > 0;
}

async function loadReportForUser(reportId, user) {
  const result = await pool.query(
    `SELECT r.*, u.first_name, u.last_name, c.name AS class_name
     FROM reports r
     JOIN users u ON u.id = r.learner_id
     LEFT JOIN classes c ON c.id = r.class_id
     WHERE r.id = $1`,
    [reportId]
  );

  if (result.rowCount === 0) {
    const error = new Error('Report not found.');
    error.statusCode = 404;
    throw error;
  }

  const report = result.rows[0];

  if (user.role === 'admin' || report.created_by === user.sub) {
    return { report, canManage: true };
  }

  if (user.role === 'teacher' && (await teacherTeachesLearner(user.sub, report.learner_id))) {
    return { report, canManage: true };
  }

  if (!report.published_at) {
    const error = new Error('This report has not been published yet.');
    error.statusCode = 403;
    throw error;
  }

  if (user.role === 'learner' && report.learner_id === user.sub) {
    return { report, canManage: false };
  }

  if (user.role === 'parent') {
    const linked = await pool.query(
      'SELECT 1 FROM parent_learners WHERE parent_id = $1 AND learner_id = $2',
      [user.sub, report.learner_id]
    );
    if (linked.rowCount > 0) {
      return { report, canManage: false };
    }
  }

  const error = new Error('You do not have permission to view this report.');
  error.statusCode = 403;
  throw error;
}

// Preview the numbers before committing them to a report.
reportsRouter.get('/preview', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const { learnerId, periodStart, periodEnd } = req.query;

    if (!learnerId || !DATE_PATTERN.test(String(periodStart)) || !DATE_PATTERN.test(String(periodEnd))) {
      return res.status(400).json({ message: 'learnerId, periodStart and periodEnd (YYYY-MM-DD) are required.' });
    }

    if (req.user.role !== 'admin' && !(await teacherTeachesLearner(req.user.sub, learnerId))) {
      return res.status(403).json({ message: 'You do not teach this learner.' });
    }

    const summary = await buildLearnerSummary(learnerId, { from: periodStart, to: periodEnd });
    return res.json({ learnerId, periodStart, periodEnd, summary });
  } catch (error) {
    return next(error);
  }
});

reportsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { role, sub } = req.user;
    let result;

    if (role === 'parent') {
      result = await pool.query(
        `SELECT r.*, u.first_name, u.last_name, c.name AS class_name
         FROM reports r
         JOIN parent_learners pl ON pl.learner_id = r.learner_id
         JOIN users u ON u.id = r.learner_id
         LEFT JOIN classes c ON c.id = r.class_id
         WHERE pl.parent_id = $1 AND r.published_at IS NOT NULL
         ORDER BY r.period_end DESC`,
        [sub]
      );
    } else if (role === 'learner') {
      result = await pool.query(
        `SELECT r.*, u.first_name, u.last_name, c.name AS class_name
         FROM reports r
         JOIN users u ON u.id = r.learner_id
         LEFT JOIN classes c ON c.id = r.class_id
         WHERE r.learner_id = $1 AND r.published_at IS NOT NULL
         ORDER BY r.period_end DESC`,
        [sub]
      );
    } else {
      result = await pool.query(
        `SELECT DISTINCT r.*, u.first_name, u.last_name, c.name AS class_name
         FROM reports r
         JOIN users u ON u.id = r.learner_id
         LEFT JOIN classes c ON c.id = r.class_id
         LEFT JOIN class_learners cl ON cl.learner_id = r.learner_id
         LEFT JOIN class_subject_teachers cst ON cst.class_id = cl.class_id
         WHERE $2 = 'admin' OR r.created_by = $1 OR cst.teacher_id = $1
         ORDER BY r.period_end DESC`,
        [sub, role]
      );
    }

    return res.json({ reports: result.rows.map((row) => mapReport(row, { includeSummary: false })) });
  } catch (error) {
    return next(error);
  }
});

reportsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { report, canManage } = await loadReportForUser(req.params.id, req.user);
    return res.json({ report: mapReport(report), canManage });
  } catch (error) {
    return next(error);
  }
});

// Builds the snapshot now; publishing is a separate step so a teacher can add
// a comment before parents are alerted.
reportsRouter.post('/', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const { learnerId, periodStart, periodEnd } = req.body;
    const periodLabel = String(req.body.periodLabel || '').trim() || null;
    const comment = String(req.body.comment || '').trim() || null;
    const publish = req.body.publish !== false;

    if (!learnerId || !DATE_PATTERN.test(String(periodStart)) || !DATE_PATTERN.test(String(periodEnd))) {
      return res.status(400).json({ message: 'learnerId, periodStart and periodEnd (YYYY-MM-DD) are required.' });
    }

    if (periodStart > periodEnd) {
      return res.status(400).json({ message: 'The period start must be before the period end.' });
    }

    if (req.user.role !== 'admin' && !(await teacherTeachesLearner(req.user.sub, learnerId))) {
      return res.status(403).json({ message: 'You do not teach this learner.' });
    }

    const learnerResult = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, cl.class_id, c.name AS class_name
       FROM users u
       LEFT JOIN class_learners cl ON cl.learner_id = u.id
       LEFT JOIN classes c ON c.id = cl.class_id
       WHERE u.id = $1 AND u.role = 'learner'`,
      [learnerId]
    );

    if (learnerResult.rowCount === 0) {
      return res.status(404).json({ message: 'Learner not found.' });
    }

    const learner = learnerResult.rows[0];
    const summary = await buildLearnerSummary(learnerId, { from: periodStart, to: periodEnd });
    const title = String(req.body.title || '').trim()
      || `${periodLabel || 'Progress'} report — ${learner.first_name} ${learner.last_name}`;

    const saved = await pool.query(
      `INSERT INTO reports (learner_id, class_id, created_by, title, period_label, period_start, period_end, summary, comment, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $10 THEN now() ELSE NULL END)
       ON CONFLICT (learner_id, period_start, period_end)
       DO UPDATE SET title = EXCLUDED.title,
                     period_label = EXCLUDED.period_label,
                     summary = EXCLUDED.summary,
                     comment = EXCLUDED.comment,
                     class_id = EXCLUDED.class_id,
                     published_at = COALESCE(reports.published_at, EXCLUDED.published_at),
                     updated_at = now()
       RETURNING *`,
      [
        learnerId,
        learner.class_id ?? null,
        req.user.sub,
        title,
        periodLabel,
        periodStart,
        periodEnd,
        JSON.stringify(summary),
        comment,
        publish,
      ]
    );

    const report = saved.rows[0];
    let notifiedParents = 0;

    if (report.published_at) {
      const recipients = await parentsOfLearner(learnerId);
      const teacher = await teacherContact(req.user.sub);
      notifiedParents = recipients.length;
      await deliver(recipients.map((recipient) => sendReportPublishedEmail({
        to: recipient.email,
        fullName: recipient.fullName,
        childName: recipient.childName,
        reportTitle: report.title,
        periodLabel: report.period_label,
        quizAverage: summary.quizzes.average,
        homeworkCompletion: summary.homework.completionRate,
        teacher,
      })));
    }

    return res.status(201).json({
      report: mapReport({ ...report, first_name: learner.first_name, last_name: learner.last_name, class_name: learner.class_name }),
      notifiedParents,
    });
  } catch (error) {
    return next(error);
  }
});

reportsRouter.post('/:id/publish', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const { report, canManage } = await loadReportForUser(req.params.id, req.user);
    if (!canManage) {
      return res.status(403).json({ message: 'You do not have permission to publish this report.' });
    }

    if (report.published_at) {
      return res.json({ report: mapReport(report), notifiedParents: 0, message: 'This report was already published.' });
    }

    const updated = await pool.query(
      'UPDATE reports SET published_at = now(), updated_at = now() WHERE id = $1 RETURNING *',
      [report.id]
    );

    const summary = updated.rows[0].summary ?? {};
    const recipients = await parentsOfLearner(report.learner_id);
    const teacher = await teacherContact(req.user.sub);
    await deliver(recipients.map((recipient) => sendReportPublishedEmail({
      to: recipient.email,
      fullName: recipient.fullName,
      childName: recipient.childName,
      reportTitle: updated.rows[0].title,
      periodLabel: updated.rows[0].period_label,
      quizAverage: summary.quizzes?.average ?? null,
      homeworkCompletion: summary.homework?.completionRate ?? null,
      teacher,
    })));

    return res.json({ report: mapReport(updated.rows[0]), notifiedParents: recipients.length });
  } catch (error) {
    return next(error);
  }
});

reportsRouter.delete('/:id', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const { report, canManage } = await loadReportForUser(req.params.id, req.user);
    if (!canManage) {
      return res.status(403).json({ message: 'You do not have permission to delete this report.' });
    }

    await pool.query('DELETE FROM reports WHERE id = $1', [report.id]);
    return res.json({ message: 'Report deleted.', id: report.id });
  } catch (error) {
    return next(error);
  }
});
