import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { buildLearnerSummary } from '../services/insights.js';

export const dashboardRouter = Router();

const MAX_NOTIFICATIONS = 50;

function calendarDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toDateKey(value) {
  const date = calendarDate(value);
  if (!date) {
    return null;
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function endOfDay(value) {
  const date = calendarDate(value);
  if (!date) {
    return null;
  }
  date.setHours(23, 59, 59, 999);
  return date;
}

function numberOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

// Teacher Dashboard
dashboardRouter.get('/teacher', requireAuth, async (req, res, next) => {
  try {
    const teacherId = req.user.sub;

    const summaryResult = await pool.query(
      `SELECT
         COUNT(DISTINCT cst.class_id) AS total_classes,
         COUNT(DISTINCT cst.subject_id) AS total_subjects,
         COUNT(DISTINCT cl.learner_id) AS total_learners
       FROM class_subject_teachers cst
       LEFT JOIN class_learners cl ON cl.class_id = cst.class_id
       WHERE cst.teacher_id = $1`,
      [teacherId]
    );

    // Get classes taught by this teacher
    const classesResult = await pool.query(
      `SELECT DISTINCT c.id, c.name, c.grade_level, c.academic_year
       FROM classes c
       JOIN class_subject_teachers cst ON c.id = cst.class_id
       WHERE cst.teacher_id = $1
       ORDER BY c.name`,
      [teacherId]
    );

    // Get subjects taught
    const subjectsResult = await pool.query(
      `SELECT DISTINCT s.id, s.name, s.code
       FROM subjects s
       JOIN class_subject_teachers cst ON s.id = cst.subject_id
       WHERE cst.teacher_id = $1
       ORDER BY s.name`,
      [teacherId]
    );

    // Get total learners taught
    const learnersResult = await pool.query(
      `SELECT COUNT(DISTINCT cl.learner_id) as total_learners
       FROM class_learners cl
       JOIN class_subject_teachers cst ON cl.class_id = cst.class_id
       WHERE cst.teacher_id = $1`,
      [teacherId]
    );

    // Get study materials uploaded
    const materialsResult = await pool.query(
      `SELECT id, title, subject, class_name, created_at
       FROM materials
       WHERE teacher_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [teacherId]
    );

    // Get recent quizzes
    const quizzesResult = await pool.query(
      `SELECT q.id, q.title, q.status, q.due_date, q.created_at, m.title as material_title
       FROM quizzes q
       LEFT JOIN materials m ON q.material_id = m.id
       WHERE q.created_by = $1
       ORDER BY q.due_date ASC NULLS LAST, q.created_at DESC
       LIMIT 10`,
      [teacherId]
    );

    // Get recent homework
    const homeworkResult = await pool.query(
      `SELECT h.id, h.title, h.subject, h.class_name, h.class_id, h.subject_id, h.due_date, h.max_score, h.created_at,
              COUNT(DISTINCT cl.learner_id) AS learner_count,
              COUNT(DISTINCT sub.learner_id) AS submitted_count,
              COUNT(DISTINCT sub.learner_id) FILTER (WHERE sub.score IS NOT NULL) AS graded_count
       FROM homework h
       LEFT JOIN class_learners cl ON cl.class_id = h.class_id
       LEFT JOIN submissions sub ON sub.homework_id = h.id
       WHERE h.teacher_id = $1
       GROUP BY h.id
       ORDER BY h.due_date ASC NULLS LAST, h.created_at DESC
       LIMIT 20`,
      [teacherId]
    );

    const classLearnersResult = await pool.query(
      `SELECT DISTINCT u.id, u.first_name, u.last_name, c.id AS class_id, c.name AS class_name
       FROM users u
       JOIN class_learners cl ON cl.learner_id = u.id
       JOIN class_subject_teachers cst ON cst.class_id = cl.class_id
       JOIN classes c ON c.id = cl.class_id
       WHERE cst.teacher_id = $1
       ORDER BY c.name, u.first_name, u.last_name`,
      [teacherId]
    );

    res.json({
      classes: classesResult.rows,
      subjects: subjectsResult.rows,
      learners: classLearnersResult.rows,
      summary: {
        totalClasses: parseInt(summaryResult.rows[0].total_classes, 10),
        totalSubjects: parseInt(summaryResult.rows[0].total_subjects, 10),
        totalLearners: parseInt(summaryResult.rows[0].total_learners, 10),
      },
      totalLearners: parseInt(learnersResult.rows[0].total_learners, 10),
      recentMaterials: materialsResult.rows,
      recentQuizzes: quizzesResult.rows,
      recentHomework: homeworkResult.rows.map((row) => ({
        ...row,
        learner_count: Number(row.learner_count),
        submitted_count: Number(row.submitted_count),
        graded_count: Number(row.graded_count),
        max_score: row.max_score === null ? null : Number(row.max_score),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Learner Dashboard
dashboardRouter.get('/learner', requireAuth, async (req, res, next) => {
  try {
    const learnerId = req.user.sub;

    // Get classes enrolled in
    const classesResult = await pool.query(
      `SELECT c.id, c.name, c.grade_level, c.academic_year
       FROM classes c
       JOIN class_learners cl ON c.id = cl.class_id
       WHERE cl.learner_id = $1
       ORDER BY c.name`,
      [learnerId]
    );

    // Get assigned homework
    const homeworkResult = await pool.query(
      `SELECT h.id, h.title, h.description, h.subject, h.class_name, h.due_date, h.created_at, h.max_score,
              sub.status AS submission_status, sub.submitted_at, sub.score, sub.feedback, sub.graded_at
       FROM homework h
       JOIN class_learners cl ON cl.learner_id = $1
       LEFT JOIN classes c ON c.id = cl.class_id
       LEFT JOIN submissions sub ON sub.homework_id = h.id AND sub.learner_id = $1
       WHERE h.class_id = cl.class_id OR (h.class_id IS NULL AND h.class_name = c.name)
       ORDER BY h.due_date ASC NULLS LAST`,
      [learnerId]
    );

    const quizzesResult = await pool.query(
      `SELECT q.id, q.title, q.status, q.due_date, q.created_at, c.name AS class_name, s.name AS subject_name,
              qs.score, qs.submitted_at
       FROM quizzes q
       JOIN class_learners cl ON cl.class_id = q.class_id
       LEFT JOIN classes c ON c.id = q.class_id
       LEFT JOIN subjects s ON s.id = q.subject_id
       LEFT JOIN quiz_submissions qs ON qs.quiz_id = q.id AND qs.learner_id = $1
       WHERE cl.learner_id = $1
         AND q.status = 'published'
       ORDER BY q.due_date ASC NULLS LAST, q.created_at DESC
       LIMIT 10`,
      [learnerId]
    );

    const materialsResult = await pool.query(
      `SELECT m.id, m.title, m.subject, m.class_name, m.created_at, m.file_name, m.file_path
       FROM materials m
       JOIN class_learners cl ON cl.class_id = m.class_id
       WHERE cl.learner_id = $1
       ORDER BY m.created_at DESC
       LIMIT 12`,
      [learnerId]
    );

    // Get submission stats
    const submissionsResult = await pool.query(
      `SELECT COUNT(*) as total_submissions, SUM(CASE WHEN score IS NOT NULL THEN 1 ELSE 0 END) as completed
       FROM submissions
       WHERE learner_id = $1`,
      [learnerId]
    );

    res.json({
      classes: classesResult.rows,
      assignedHomework: homeworkResult.rows,
      availableQuizzes: quizzesResult.rows,
      studyMaterials: materialsResult.rows.map((material) => ({
        ...material,
        fileUrl: `/uploads/${material.file_path}`,
      })),
      submissionStats: {
        totalSubmissions: parseInt(submissionsResult.rows[0].total_submissions, 10),
        completed: parseInt(submissionsResult.rows[0].completed || 0, 10),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Parent Dashboard
dashboardRouter.get('/parent', requireAuth, async (req, res, next) => {
  try {
    const parentId = req.user.sub;

    // Get children linked to parent
    const childrenResult = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email
       FROM users u
       JOIN parent_learners pl ON u.id = pl.learner_id
       WHERE pl.parent_id = $1
       ORDER BY u.first_name, u.last_name`,
      [parentId]
    );

    // Get children classes
    const childrenClassesResult = await pool.query(
      `SELECT c.id, c.name, u.first_name, u.last_name, cl.learner_id
       FROM classes c
       JOIN class_learners cl ON c.id = cl.class_id
       JOIN users u ON cl.learner_id = u.id
       WHERE cl.learner_id IN (SELECT learner_id FROM parent_learners WHERE parent_id = $1)
       ORDER BY u.first_name, c.name`,
      [parentId]
    );

    // Get recent quiz results for children
    const quizResultsResult = await pool.query(
      `SELECT qs.id, qs.score, qs.quiz_id, qs.learner_id, q.title, u.first_name, u.last_name, qs.submitted_at AS created_at
       FROM quiz_submissions qs
       JOIN quizzes q ON qs.quiz_id = q.id
       JOIN users u ON qs.learner_id = u.id
       WHERE qs.learner_id IN (SELECT learner_id FROM parent_learners WHERE parent_id = $1)
       ORDER BY qs.submitted_at DESC
       LIMIT 15`,
      [parentId]
    );

    const homeworkResult = await pool.query(
      `SELECT h.id, h.title, h.description, h.subject, h.class_name, h.due_date, h.created_at, h.max_score,
              u.id AS learner_id, u.first_name, u.last_name,
              sub.status AS submission_status, sub.submitted_at, sub.score, sub.feedback, sub.graded_at
       FROM homework h
       JOIN class_learners cl ON h.class_id = cl.class_id OR (h.class_id IS NULL AND h.class_name IN (
         SELECT c.name FROM classes c WHERE c.id = cl.class_id
       ))
       JOIN parent_learners pl ON pl.learner_id = cl.learner_id
       JOIN users u ON u.id = cl.learner_id
       LEFT JOIN submissions sub ON sub.homework_id = h.id AND sub.learner_id = cl.learner_id
       WHERE pl.parent_id = $1
       ORDER BY h.due_date ASC NULLS LAST, u.first_name ASC`,
      [parentId]
    );

    const reportsResult = await pool.query(
      `SELECT r.id, r.title, r.period_label, r.period_start, r.period_end, r.published_at, r.summary,
              u.id AS learner_id, u.first_name, u.last_name
       FROM reports r
       JOIN parent_learners pl ON pl.learner_id = r.learner_id
       JOIN users u ON u.id = r.learner_id
       WHERE pl.parent_id = $1 AND r.published_at IS NOT NULL
       ORDER BY r.period_end DESC`,
      [parentId]
    );

    const seenResult = await pool.query('SELECT notifications_seen_at FROM users WHERE id = $1', [parentId]);
    const seenAt = seenResult.rows[0]?.notifications_seen_at ?? null;

    const messagesResult = await pool.query(
      `SELECT m.id, m.title, m.body, m.created_at, m.learner_id,
              m.parent_reply, m.parent_replied_at,
              t.first_name AS teacher_first_name, t.last_name AS teacher_last_name,
              t.email AS teacher_email, t.phone AS teacher_phone,
              l.first_name AS learner_first_name, l.last_name AS learner_last_name
       FROM parent_messages m
       JOIN users t ON t.id = m.teacher_id
       LEFT JOIN users l ON l.id = m.learner_id
       WHERE m.parent_id = $1
       ORDER BY m.created_at DESC
       LIMIT 30`,
      [parentId]
    );

    const childQuizzesResult = await pool.query(
      `SELECT q.id AS quiz_id, q.title, q.due_date, q.created_at,
              c.name AS class_name, s.name AS subject_name,
              u.id AS learner_id, u.first_name, u.last_name,
              qs.id AS submission_id, qs.score, qs.submitted_at
       FROM quizzes q
       JOIN class_learners cl ON cl.class_id = q.class_id
       JOIN parent_learners pl ON pl.learner_id = cl.learner_id
       JOIN users u ON u.id = cl.learner_id
       LEFT JOIN classes c ON c.id = q.class_id
       LEFT JOIN subjects s ON s.id = q.subject_id
       LEFT JOIN quiz_submissions qs ON qs.quiz_id = q.id AND qs.learner_id = cl.learner_id
       WHERE pl.parent_id = $1
         AND q.status = 'published'
       ORDER BY (qs.id IS NULL) DESC, q.due_date ASC NULLS LAST, q.created_at DESC`,
      [parentId]
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const soon = new Date(today);
    soon.setDate(soon.getDate() + 3);

    const childHomework = homeworkResult.rows.map((row) => {
      const due = calendarDate(row.due_date);
      const completed = row.submission_status === 'submitted' || row.submission_status === 'late';
      const maxScore = numberOrNull(row.max_score);
      const score = numberOrNull(row.score);

      return {
        id: `${row.id}-${row.learner_id}`,
        homeworkId: row.id,
        title: row.title,
        description: row.description,
        subject: row.subject,
        className: row.class_name,
        dueDate: toDateKey(row.due_date),
        createdAt: row.created_at,
        learnerId: row.learner_id,
        childName: `${row.first_name} ${row.last_name}`.trim(),
        completed,
        overdue: Boolean(!completed && due && due < today),
        dueSoon: Boolean(!completed && due && due >= today && due <= soon),
        submittedAt: row.submitted_at,
        score,
        maxScore,
        percentage: score !== null && maxScore ? Math.round((score / maxScore) * 100) : null,
        feedback: row.feedback,
        gradedAt: row.graded_at,
      };
    });

    // Each notification carries the moment it became true, so "mark as seen"
    // can clear it. Overdue uses the due date, which re-alerts the parent when
    // a deadline passes.
    const notifications = [];

    childHomework.forEach((item) => {
      const push = (type, message, at) => {
        if (at) {
          notifications.push({
            id: `${type}-${item.id}`,
            type,
            message,
            at: new Date(at).toISOString(),
            title: item.title,
            subject: item.subject,
            className: item.className,
            dueDate: item.dueDate,
            learnerId: item.learnerId,
            childName: item.childName,
          });
        }
      };

      if (item.gradedAt && item.score !== null) {
        push(
          'graded',
          `I have marked ${item.childName}'s homework “${item.title}”. They scored ${item.score} out of ${item.maxScore}.`,
          item.gradedAt
        );
      } else if (item.completed) {
        push('completed', `${item.childName} has handed in “${item.title}”. A mark will follow once I have looked at it.`, item.submittedAt);
      } else if (item.overdue) {
        push('overdue', `${item.childName}'s homework “${item.title}” is now overdue. A gentle reminder at home would help.`, endOfDay(item.dueDate));
      } else if (item.dueSoon) {
        push('due_soon', `${item.childName}'s homework “${item.title}” is due soon. Please check they have a plan for it.`, item.createdAt);
      } else {
        push('assigned', `${item.childName} has new homework: “${item.title}”.`, item.createdAt);
      }
    });

    const childReports = reportsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      periodLabel: row.period_label,
      periodStart: toDateKey(row.period_start),
      periodEnd: toDateKey(row.period_end),
      publishedAt: row.published_at,
      learnerId: row.learner_id,
      childName: `${row.first_name} ${row.last_name}`.trim(),
      summary: row.summary ?? {},
    }));

    childReports.forEach((report) => {
      notifications.push({
        id: `report-${report.id}`,
        type: 'report',
        message: `${report.childName}'s ${report.periodLabel || 'term'} report is ready. Please sit with them and go through it — the official school copy will still come home.`,
        at: new Date(report.publishedAt).toISOString(),
        title: report.title,
        learnerId: report.learnerId,
        childName: report.childName,
        reportId: report.id,
        href: `/reports/${report.id}`,
      });
    });

    messagesResult.rows.forEach((row) => {
      const childName = row.learner_first_name ? `${row.learner_first_name} ${row.learner_last_name}`.trim() : 'your child';
      const teacherName = `${row.teacher_first_name} ${row.teacher_last_name}`.trim();
      notifications.push({
        id: `message-${row.id}`,
        type: 'message',
        message: `${teacherName} wrote to you about ${childName}: “${row.title}”.`,
        detail: row.body,
        at: new Date(row.created_at).toISOString(),
        title: row.title,
        learnerId: row.learner_id,
        childName,
        teacherName,
        teacherEmail: row.teacher_email,
        teacherPhone: row.teacher_phone,
      });
    });

    childQuizzesResult.rows
      .filter((quiz) => quiz.submission_id && quiz.submitted_at)
      .forEach((quiz) => {
        notifications.push({
          id: `quiz-${quiz.quiz_id}-${quiz.learner_id}`,
          type: 'quiz_completed',
          message: `${quiz.first_name} ${quiz.last_name} has finished the quiz “${quiz.title}” and scored ${Number(quiz.score)}%. You can review it with them, but you cannot retake it.`,
          at: new Date(quiz.submitted_at).toISOString(),
          title: quiz.title,
          learnerId: quiz.learner_id,
          childName: `${quiz.first_name} ${quiz.last_name}`.trim(),
          href: `/quizzes/${quiz.quiz_id}?learnerId=${quiz.learner_id}`,
        });
      });

    const seenTime = seenAt ? new Date(seenAt).getTime() : 0;
    const feed = notifications
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, MAX_NOTIFICATIONS)
      .map((item) => ({ ...item, unread: new Date(item.at).getTime() > seenTime }));

    const childInsights = await Promise.all(
      childrenResult.rows.map(async (child) => ({
        learnerId: child.id,
        childName: `${child.first_name} ${child.last_name}`.trim(),
        ...(await buildLearnerSummary(child.id, null)),
      }))
    );

    res.json({
      children: childrenResult.rows,
      childrenClasses: childrenClassesResult.rows,
      recentQuizResults: quizResultsResult.rows,
      homeworkNotifications: feed,
      unreadCount: feed.filter((item) => item.unread).length,
      notificationsSeenAt: seenAt,
      childHomework,
      childReports,
      childInsights,
      childQuizzes: childQuizzesResult.rows,
      parentMessages: messagesResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        createdAt: row.created_at,
        learnerId: row.learner_id,
        childName: row.learner_first_name ? `${row.learner_first_name} ${row.learner_last_name}`.trim() : null,
        teacherName: `${row.teacher_first_name} ${row.teacher_last_name}`.trim(),
        teacherEmail: row.teacher_email,
        teacherPhone: row.teacher_phone,
        parentReply: row.parent_reply || null,
        parentRepliedAt: row.parent_replied_at || null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.post('/parent/notifications/seen', requireAuth, requireRole('parent'), async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE users SET notifications_seen_at = now() WHERE id = $1 RETURNING notifications_seen_at',
      [req.user.sub]
    );

    return res.json({ notificationsSeenAt: result.rows[0].notifications_seen_at, unreadCount: 0 });
  } catch (error) {
    return next(error);
  }
});

// Admin Dashboard
dashboardRouter.get('/admin', requireAuth, async (req, res, next) => {
  try {
    // Get total users by role
    const usersCountResult = await pool.query(
      `SELECT role, COUNT(*) as count
       FROM users
       GROUP BY role`
    );

    // Get total classes
    const classesCountResult = await pool.query(
      `SELECT COUNT(*) as total FROM classes`
    );

    // Get total subjects
    const subjectsCountResult = await pool.query(
      `SELECT COUNT(*) as total FROM subjects`
    );

    // Get total materials
    const materialsCountResult = await pool.query(
      `SELECT COUNT(*) as total FROM materials`
    );

    res.json({
      userStats: usersCountResult.rows.reduce((acc, row) => {
        acc[row.role] = parseInt(row.count);
        return acc;
      }, {}),
      totalClasses: parseInt(classesCountResult.rows[0].total),
      totalSubjects: parseInt(subjectsCountResult.rows[0].total),
      totalMaterials: parseInt(materialsCountResult.rows[0].total),
    });
  } catch (error) {
    next(error);
  }
});
