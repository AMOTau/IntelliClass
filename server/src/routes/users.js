import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendCredentialsEmail } from '../utils/email.js';

export const usersRouter = Router();

const DEFAULT_PROVISIONED_PASSWORD = 'Password@1';

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

const allowedRoles = new Set(['admin', 'teacher', 'learner', 'parent']);

async function ensureUserWithRole(userId, expectedRole, fieldName) {
  const result = await pool.query('SELECT id, role FROM users WHERE id = $1', [userId]);

  if (result.rowCount === 0) {
    const error = new Error(`${fieldName} does not exist.`);
    error.statusCode = 404;
    throw error;
  }

  if (result.rows[0].role !== expectedRole) {
    const error = new Error(`${fieldName} must belong to a ${expectedRole}.`);
    error.statusCode = 400;
    throw error;
  }
}

usersRouter.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { firstName, lastName, email, role } = req.body;

    if (!firstName || !lastName || !email || !role) {
      return res.status(400).json({
        message: 'firstName, lastName, email, and role are required.',
      });
    }

    if (!allowedRoles.has(role) || role === 'admin') {
      return res.status(400).json({
        message: 'role must be teacher, learner, or parent for admin provisioning.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    await client.query('BEGIN');

    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);

    if (existingUser.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PROVISIONED_PASSWORD, 10);
    const created = await client.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, role, first_name, last_name, email, created_at, updated_at`,
      [firstName.trim(), lastName.trim(), normalizedEmail, passwordHash, role]
    );

    await client.query('COMMIT');

    let emailSent = true;

    try {
      await sendCredentialsEmail({
        to: normalizedEmail,
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        role,
        email: normalizedEmail,
        password: DEFAULT_PROVISIONED_PASSWORD,
      });
    } catch (emailError) {
      emailSent = false;
      console.error('Failed to send credentials email for provisioned user:', emailError);
    }

    return res.status(201).json({
      user: buildPublicUser(created.rows[0]),
      emailSent,
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

usersRouter.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { role } = req.query;

    const params = [];
    let whereClause = '';

    if (role) {
      params.push(role);
      whereClause = 'WHERE role = $1';
    }

    const result = await pool.query(
      `SELECT id, role, first_name, last_name, email, created_at, updated_at
       FROM users
       ${whereClause}
       ORDER BY created_at DESC`,
      params
    );

    return res.json({ users: result.rows.map(buildPublicUser) });
  } catch (error) {
    return next(error);
  }
});

usersRouter.post('/link-parent-learner', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { parentId, learnerId } = req.body;

    if (!parentId || !learnerId) {
      return res.status(400).json({ message: 'parentId and learnerId are required.' });
    }

    await ensureUserWithRole(parentId, 'parent', 'parentId');
    await ensureUserWithRole(learnerId, 'learner', 'learnerId');

    await pool.query(
      `INSERT INTO parent_learners (parent_id, learner_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [parentId, learnerId]
    );

    return res.status(201).json({ message: 'Parent linked to learner successfully.' });
  } catch (error) {
    return next(error);
  }
});

usersRouter.post('/link-learner-class', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { learnerId, classId } = req.body;

    if (!learnerId || !classId) {
      return res.status(400).json({ message: 'learnerId and classId are required.' });
    }

    await ensureUserWithRole(learnerId, 'learner', 'learnerId');

    const classRow = await pool.query('SELECT id FROM classes WHERE id = $1', [classId]);
    if (classRow.rowCount === 0) {
      return res.status(404).json({ message: 'classId does not exist.' });
    }

    await pool.query(
      `INSERT INTO class_learners (class_id, learner_id)
       VALUES ($1, $2)
       ON CONFLICT (learner_id) DO UPDATE SET class_id = EXCLUDED.class_id`,
      [classId, learnerId]
    );

    return res.status(201).json({ message: 'Learner linked to class successfully.' });
  } catch (error) {
    return next(error);
  }
});

usersRouter.post('/link-teacher-class-subject', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { teacherId, classId, subjectId } = req.body;

    if (!teacherId || !classId || !subjectId) {
      return res.status(400).json({ message: 'teacherId, classId, and subjectId are required.' });
    }

    await ensureUserWithRole(teacherId, 'teacher', 'teacherId');

    const classRow = await pool.query('SELECT id FROM classes WHERE id = $1', [classId]);
    if (classRow.rowCount === 0) {
      return res.status(404).json({ message: 'classId does not exist.' });
    }

    const subjectRow = await pool.query('SELECT id FROM subjects WHERE id = $1', [subjectId]);
    if (subjectRow.rowCount === 0) {
      return res.status(404).json({ message: 'subjectId does not exist.' });
    }

    await pool.query(
      `INSERT INTO class_subject_teachers (class_id, subject_id, teacher_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [classId, subjectId, teacherId]
    );

    return res.status(201).json({ message: 'Teacher linked to class and subject successfully.' });
  } catch (error) {
    return next(error);
  }
});

usersRouter.post('/provision-learner-family', requireAuth, requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();

  try {
    const {
      learnerFirstName,
      learnerLastName,
      learnerEmail,
      classId,
      parentFirstName,
      parentLastName,
      parentEmail,
    } = req.body;

    if (!learnerFirstName || !learnerLastName || !learnerEmail || !classId || !parentEmail) {
      return res.status(400).json({
        message: 'learnerFirstName, learnerLastName, learnerEmail, classId, and parentEmail are required.',
      });
    }

    await client.query('BEGIN');

    const classRow = await client.query('SELECT id FROM classes WHERE id = $1', [classId]);
    if (classRow.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'classId does not exist.' });
    }

    const normalizedParentEmail = parentEmail.trim().toLowerCase();
    const normalizedLearnerEmail = learnerEmail.trim().toLowerCase();

    let parentRow;
    let parentCreated = false;

    const existingParent = await client.query(
      `SELECT id, role, first_name, last_name, email, created_at, updated_at
       FROM users
       WHERE email = $1`,
      [normalizedParentEmail]
    );

    if (existingParent.rowCount > 0) {
      if (existingParent.rows[0].role !== 'parent') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'parentEmail already exists and is not a parent account.' });
      }

      parentRow = existingParent.rows[0];
    } else {
      if (!parentFirstName || !parentLastName) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: 'parentFirstName and parentLastName are required when parentEmail has no existing account.',
        });
      }

      const parentPasswordHash = await bcrypt.hash(DEFAULT_PROVISIONED_PASSWORD, 10);
      const createdParent = await client.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, 'parent')
         RETURNING id, role, first_name, last_name, email, created_at, updated_at`,
        [parentFirstName.trim(), parentLastName.trim(), normalizedParentEmail, parentPasswordHash]
      );

      parentRow = createdParent.rows[0];
      parentCreated = true;
    }

    const existingLearner = await client.query('SELECT id FROM users WHERE email = $1', [normalizedLearnerEmail]);
    if (existingLearner.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'An account with learnerEmail already exists.' });
    }

    const learnerPasswordHash = await bcrypt.hash(DEFAULT_PROVISIONED_PASSWORD, 10);
    const createdLearner = await client.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'learner')
       RETURNING id, role, first_name, last_name, email, created_at, updated_at`,
      [learnerFirstName.trim(), learnerLastName.trim(), normalizedLearnerEmail, learnerPasswordHash]
    );

    const learnerRow = createdLearner.rows[0];

    await client.query(
      `INSERT INTO class_learners (class_id, learner_id)
       VALUES ($1, $2)
       ON CONFLICT (learner_id) DO UPDATE SET class_id = EXCLUDED.class_id`,
      [classId, learnerRow.id]
    );

    await client.query(
      `INSERT INTO parent_learners (parent_id, learner_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [parentRow.id, learnerRow.id]
    );

    await client.query('COMMIT');

    const emailJobs = [
      sendCredentialsEmail({
        to: normalizedLearnerEmail,
        fullName: `${learnerFirstName.trim()} ${learnerLastName.trim()}`,
        role: 'learner',
        email: normalizedLearnerEmail,
        password: DEFAULT_PROVISIONED_PASSWORD,
      }),
    ];

    if (parentCreated) {
      emailJobs.push(
        sendCredentialsEmail({
          to: normalizedParentEmail,
          fullName: `${parentFirstName.trim()} ${parentLastName.trim()}`,
          role: 'parent',
          email: normalizedParentEmail,
          password: DEFAULT_PROVISIONED_PASSWORD,
        })
      );
    }

    const emailResults = await Promise.allSettled(emailJobs);
    const emailSent = emailResults.every((result) => result.status === 'fulfilled');

    if (!emailSent) {
      console.error('One or more credentials emails failed to send for learner-family provisioning.');
    }

    return res.status(201).json({
      message: 'Learner and parent provisioned successfully.',
      parentCreated,
      learner: buildPublicUser(learnerRow),
      parent: buildPublicUser(parentRow),
      emailSent,
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

usersRouter.post('/provision-teacher-assignment', requireAuth, requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();

  try {
    const {
      teacherFirstName,
      teacherLastName,
      teacherEmail,
      classId,
      subjectIds,
    } = req.body;

    if (!teacherFirstName || !teacherLastName || !teacherEmail || !classId) {
      return res.status(400).json({
        message: 'teacherFirstName, teacherLastName, teacherEmail, and classId are required.',
      });
    }

    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
      return res.status(400).json({ message: 'subjectIds must be a non-empty array.' });
    }

    await client.query('BEGIN');

    const classRow = await client.query('SELECT id FROM classes WHERE id = $1', [classId]);
    if (classRow.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'classId does not exist.' });
    }

    const distinctSubjectIds = [...new Set(subjectIds)];
    const subjectRows = await client.query('SELECT id FROM subjects WHERE id = ANY($1::uuid[])', [distinctSubjectIds]);

    if (subjectRows.rowCount !== distinctSubjectIds.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'One or more subjectIds do not exist.' });
    }

    const normalizedTeacherEmail = teacherEmail.trim().toLowerCase();
    const existingTeacher = await client.query('SELECT id FROM users WHERE email = $1', [normalizedTeacherEmail]);

    if (existingTeacher.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'An account with teacherEmail already exists.' });
    }

    const teacherPasswordHash = await bcrypt.hash(DEFAULT_PROVISIONED_PASSWORD, 10);
    const createdTeacher = await client.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'teacher')
       RETURNING id, role, first_name, last_name, email, created_at, updated_at`,
      [teacherFirstName.trim(), teacherLastName.trim(), normalizedTeacherEmail, teacherPasswordHash]
    );

    const teacherRow = createdTeacher.rows[0];

    for (const subjectId of distinctSubjectIds) {
      await client.query(
        `INSERT INTO class_subject_teachers (class_id, subject_id, teacher_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [classId, subjectId, teacherRow.id]
      );
    }

    await client.query('COMMIT');

    let emailSent = true;

    try {
      await sendCredentialsEmail({
        to: normalizedTeacherEmail,
        fullName: `${teacherFirstName.trim()} ${teacherLastName.trim()}`,
        role: 'teacher',
        email: normalizedTeacherEmail,
        password: DEFAULT_PROVISIONED_PASSWORD,
      });
    } catch (emailError) {
      emailSent = false;
      console.error('Failed to send credentials email for provisioned teacher:', emailError);
    }

    return res.status(201).json({
      message: 'Teacher provisioned and assigned successfully.',
      teacher: buildPublicUser(teacherRow),
      emailSent,
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

usersRouter.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, role, first_name, last_name, email, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [req.user.sub]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User profile not found.' });
    }

    return res.json({ user: buildPublicUser(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

usersRouter.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { firstName, lastName } = req.body;

    if (!firstName && !lastName) {
      return res.status(400).json({ message: 'Provide firstName or lastName to update the profile.' });
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (firstName) {
      fields.push(`first_name = $${index++}`);
      values.push(firstName.trim());
    }

    if (lastName) {
      fields.push(`last_name = $${index++}`);
      values.push(lastName.trim());
    }

    fields.push(`updated_at = now()`);
    values.push(req.user.sub);

    const result = await pool.query(
      `UPDATE users
       SET ${fields.join(', ')}
       WHERE id = $${index}
       RETURNING id, role, first_name, last_name, email, created_at, updated_at`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User profile not found.' });
    }

    return res.json({ user: buildPublicUser(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
});
