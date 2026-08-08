import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

export const dashboardRouter = Router();

// Teacher Dashboard
dashboardRouter.get('/teacher', requireAuth, async (req, res, next) => {
  try {
    const teacherId = req.user.id;

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
      `SELECT q.id, q.title, q.status, q.created_at, m.title as material_title
       FROM quizzes q
       LEFT JOIN materials m ON q.material_id = m.id
       WHERE q.created_by = $1
       ORDER BY q.created_at DESC
       LIMIT 10`,
      [teacherId]
    );

    // Get recent homework
    const homeworkResult = await pool.query(
      `SELECT id, title, subject, class_name, due_date, created_at
       FROM homework
       WHERE teacher_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [teacherId]
    );

    res.json({
      classes: classesResult.rows,
      subjects: subjectsResult.rows,
      totalLearners: parseInt(learnersResult.rows[0].total_learners),
      recentMaterials: materialsResult.rows,
      recentQuizzes: quizzesResult.rows,
      recentHomework: homeworkResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Learner Dashboard
dashboardRouter.get('/learner', requireAuth, async (req, res, next) => {
  try {
    const learnerId = req.user.id;

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
      `SELECT h.id, h.title, h.description, h.subject, h.due_date, h.created_at
       FROM homework h
       WHERE h.class_name IN (SELECT c.name FROM classes c JOIN class_learners cl ON c.id = cl.class_id WHERE cl.learner_id = $1)
       ORDER BY h.due_date ASC`,
      [learnerId]
    );

    // Get available quizzes
    const quizzesResult = await pool.query(
      `SELECT q.id, q.title, q.status, q.created_at
       FROM quizzes q
       WHERE q.status = 'published'
       ORDER BY q.created_at DESC
       LIMIT 10`,
      []
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
      submissionStats: {
        totalSubmissions: parseInt(submissionsResult.rows[0].total_submissions),
        completed: parseInt(submissionsResult.rows[0].completed),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Parent Dashboard
dashboardRouter.get('/parent', requireAuth, async (req, res, next) => {
  try {
    const parentId = req.user.id;

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
      `SELECT s.id, s.score, s.quiz_id, q.title, u.first_name, u.last_name, s.created_at
       FROM submissions s
       JOIN quizzes q ON s.quiz_id = q.id
       JOIN users u ON s.learner_id = u.id
       WHERE s.learner_id IN (SELECT learner_id FROM parent_learners WHERE parent_id = $1)
       ORDER BY s.created_at DESC
       LIMIT 15`,
      [parentId]
    );

    res.json({
      children: childrenResult.rows,
      childrenClasses: childrenClassesResult.rows,
      recentQuizResults: quizResultsResult.rows,
    });
  } catch (error) {
    next(error);
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
