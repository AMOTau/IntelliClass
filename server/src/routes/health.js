import { Router } from 'express';
import { pool } from '../config/db.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT NOW() AS timestamp');
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: result.rows[0].timestamp,
    });
  } catch (error) {
    next(error);
  }
});
