import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const subjectsRouter = Router();

subjectsRouter.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, code, created_at, updated_at
       FROM subjects
       ORDER BY name ASC`
    );

    return res.json({ subjects: result.rows });
  } catch (error) {
    return next(error);
  }
});

subjectsRouter.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, code } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'name is required.' });
    }

    const result = await pool.query(
      `INSERT INTO subjects (name, code)
       VALUES ($1, $2)
       RETURNING id, name, code, created_at, updated_at`,
      [name.trim(), code?.trim() || null]
    );

    return res.status(201).json({ subject: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});
