import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { signAuthToken } from '../utils/jwt.js';

export const authRouter = Router();

function buildPublicUser(user) {
  return {
    id: user.id,
    role: user.role,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

authRouter.post('/bootstrap-admin', async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, bootstrapKey } = req.body;

    if (!env.bootstrapAdminKey) {
      return res.status(403).json({ message: 'BOOTSTRAP_ADMIN_KEY is not configured on the server.' });
    }

    if (bootstrapKey !== env.bootstrapAdminKey) {
      return res.status(401).json({ message: 'Invalid bootstrap key.' });
    }

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'firstName, lastName, email, and password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'password must be at least 8 characters long.' });
    }

    const adminCount = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
    if (adminCount.rows[0].count > 0) {
      return res.status(409).json({ message: 'An admin account already exists. Bootstrap is disabled.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rowCount > 0) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin')
       RETURNING id, role, first_name, last_name, email, created_at, updated_at`,
      [firstName.trim(), lastName.trim(), normalizedEmail, passwordHash]
    );

    const user = buildPublicUser(created.rows[0]);
    const token = signAuthToken({ sub: user.id, role: user.role });

    return res.status(201).json({ user, token });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/register', async (req, res, next) => {
  return res.status(403).json({
    message: 'Self-registration is disabled. Accounts are provisioned by administrators.',
  });
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query(
      `SELECT id, role, first_name, last_name, email, password_hash, created_at, updated_at
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const userRecord = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, userRecord.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = buildPublicUser(userRecord);
    const token = signAuthToken({ sub: user.id, role: user.role });

    return res.json({ user, token });
  } catch (error) {
    return next(error);
  }
});
