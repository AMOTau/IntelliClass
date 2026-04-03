import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const classesRouter = Router();

classesRouter.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, grade_level, academic_year, created_at, updated_at
       FROM classes
       ORDER BY academic_year DESC NULLS LAST, name ASC`
    );

    return res.json({ classes: result.rows });
  } catch (error) {
    return next(error);
  }
});

classesRouter.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, gradeLevel, academicYear } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'name is required.' });
    }

    const result = await pool.query(
      `INSERT INTO classes (name, grade_level, academic_year)
       VALUES ($1, $2, $3)
       RETURNING id, name, grade_level, academic_year, created_at, updated_at`,
      [name.trim(), gradeLevel?.trim() || null, academicYear ? Number(academicYear) : null]
    );

    return res.status(201).json({ classItem: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});
