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

function normalizeTeacherAssignments(body) {
  if (Array.isArray(body.assignments)) {
    return body.assignments
      .map((assignment) => ({
        classId: assignment?.classId,
        subjectIds: Array.isArray(assignment?.subjectIds) ? assignment.subjectIds.filter(Boolean) : [],
      }))
      .filter((assignment) => assignment.classId && assignment.subjectIds.length > 0);
  }

  if (body.classId && Array.isArray(body.subjectIds)) {
    const subjectIds = body.subjectIds.filter(Boolean);
    if (subjectIds.length === 0) {
      return [];
    }

    return [{ classId: body.classId, subjectIds }];
  }

  return [];
}

async function validateTeacherAssignments(client, assignments) {
  const classIds = [...new Set(assignments.map((assignment) => assignment.classId))];
  const subjectIds = [...new Set(assignments.flatMap((assignment) => assignment.subjectIds))];

  if (classIds.length === 0 || subjectIds.length === 0) {
    const error = new Error('Teacher assignments must include at least one class and one subject.');
    error.statusCode = 400;
    throw error;
  }

  const classRows = await client.query('SELECT id FROM classes WHERE id = ANY($1::uuid[])', [classIds]);
  if (classRows.rowCount !== classIds.length) {
    const error = new Error('One or more classIds do not exist.');
    error.statusCode = 404;
    throw error;
  }

  const subjectRows = await client.query('SELECT id FROM subjects WHERE id = ANY($1::uuid[])', [subjectIds]);
  if (subjectRows.rowCount !== subjectIds.length) {
    const error = new Error('One or more subjectIds do not exist.');
    error.statusCode = 404;
    throw error;
  }
}

async function insertTeacherAssignments(client, teacherId, assignments) {
  for (const assignment of assignments) {
    for (const subjectId of assignment.subjectIds) {
      await client.query(
        `INSERT INTO class_subject_teachers (class_id, subject_id, teacher_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [assignment.classId, subjectId, teacherId]
      );
    }
  }
}

async function loadUserDetails(userId, role) {
  if (role === 'teacher') {
    const result = await pool.query(
      `SELECT c.id AS class_id, c.name AS class_name, c.grade_level, c.academic_year,
              s.id AS subject_id, s.name AS subject_name, s.code AS subject_code
       FROM class_subject_teachers cst
       JOIN classes c ON c.id = cst.class_id
       JOIN subjects s ON s.id = cst.subject_id
       WHERE cst.teacher_id = $1
       ORDER BY c.name ASC, s.name ASC`,
      [userId]
    );

    const assignmentsByClass = new Map();

    for (const row of result.rows) {
      if (!assignmentsByClass.has(row.class_id)) {
        assignmentsByClass.set(row.class_id, {
          classId: row.class_id,
          className: row.class_name,
          gradeLevel: row.grade_level,
          academicYear: row.academic_year,
          subjects: [],
        });
      }

      assignmentsByClass.get(row.class_id).subjects.push({
        id: row.subject_id,
        name: row.subject_name,
        code: row.subject_code,
      });
    }

    return { assignments: [...assignmentsByClass.values()] };
  }

  if (role === 'learner') {
    const classResult = await pool.query(
      `SELECT c.id, c.name, c.grade_level, c.academic_year
       FROM class_learners cl
       JOIN classes c ON c.id = cl.class_id
       WHERE cl.learner_id = $1
       LIMIT 1`,
      [userId]
    );

    const parentsResult = await pool.query(
      `SELECT u.id, u.role, u.first_name, u.last_name, u.email, u.created_at, u.updated_at
       FROM users u
       JOIN parent_learners pl ON u.id = pl.parent_id
       WHERE pl.learner_id = $1
       ORDER BY u.first_name ASC, u.last_name ASC`,
      [userId]
    );

    return {
      class: classResult.rows[0] ?? null,
      parents: parentsResult.rows.map(buildPublicUser),
    };
  }

  if (role === 'parent') {
    const learnersResult = await pool.query(
      `SELECT u.id, u.role, u.first_name, u.last_name, u.email, u.created_at, u.updated_at
       FROM users u
       JOIN parent_learners pl ON u.id = pl.learner_id
       WHERE pl.parent_id = $1
       ORDER BY u.first_name ASC, u.last_name ASC`,
      [userId]
    );

    return {
      learners: learnersResult.rows.map(buildPublicUser),
    };
  }

  return {};
}

async function replaceTeacherAssignments(client, teacherId, assignments) {
  await validateTeacherAssignments(client, assignments);

  await client.query('DELETE FROM class_subject_teachers WHERE teacher_id = $1', [teacherId]);
  await insertTeacherAssignments(client, teacherId, assignments);
}

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
      subjectIds,
      assignments,
    } = req.body;

    if (!teacherFirstName || !teacherLastName || !teacherEmail) {
      return res.status(400).json({
        message: 'teacherFirstName, teacherLastName, and teacherEmail are required.',
      });
    }

    const normalizedAssignments = normalizeTeacherAssignments({ assignments, subjectIds });

    if (normalizedAssignments.length === 0) {
      return res.status(400).json({ message: 'Provide at least one class and subject assignment.' });
    }

    await client.query('BEGIN');

    await validateTeacherAssignments(client, normalizedAssignments);

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

    await insertTeacherAssignments(client, teacherRow.id, normalizedAssignments);

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

usersRouter.get('/:userId', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT id, role, first_name, last_name, email, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = buildPublicUser(result.rows[0]);
    const details = await loadUserDetails(user.id, user.role);

    return res.json({ user, details });
  } catch (error) {
    return next(error);
  }
});

usersRouter.put('/:userId', requireAuth, requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { userId } = req.params;
    const { firstName, lastName, email, classId, assignments, subjectIds } = req.body;

    const userResult = await client.query(
      `SELECT id, role, first_name, last_name, email, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const currentUser = userResult.rows[0];
    const updates = [];
    const values = [];
    let index = 1;

    if (typeof firstName === 'string') {
      const trimmedFirstName = firstName.trim();

      if (!trimmedFirstName) {
        return res.status(400).json({ message: 'firstName cannot be empty.' });
      }

      updates.push(`first_name = $${index++}`);
      values.push(trimmedFirstName);
    }

    if (typeof lastName === 'string') {
      const trimmedLastName = lastName.trim();

      if (!trimmedLastName) {
        return res.status(400).json({ message: 'lastName cannot be empty.' });
      }

      updates.push(`last_name = $${index++}`);
      values.push(trimmedLastName);
    }

    if (typeof email === 'string') {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        return res.status(400).json({ message: 'email cannot be empty.' });
      }

      const existingUser = await client.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [normalizedEmail, userId]);

      if (existingUser.rowCount > 0) {
        return res.status(409).json({ message: 'An account with this email already exists.' });
      }

      updates.push(`email = $${index++}`);
      values.push(normalizedEmail);
    }

    const assignmentInputProvided =
      Object.prototype.hasOwnProperty.call(req.body, 'assignments') ||
      Object.prototype.hasOwnProperty.call(req.body, 'subjectIds');
    const normalizedAssignments = normalizeTeacherAssignments({ assignments, classId, subjectIds });

    await client.query('BEGIN');

    if (updates.length > 0) {
      updates.push('updated_at = now()');
      values.push(userId);

      const updated = await client.query(
        `UPDATE users
         SET ${updates.join(', ')}
         WHERE id = $${index}
         RETURNING id, role, first_name, last_name, email, created_at, updated_at`,
        values
      );

      if (updated.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'User not found.' });
      }

      currentUser.id = updated.rows[0].id;
      currentUser.role = updated.rows[0].role;
      currentUser.first_name = updated.rows[0].first_name;
      currentUser.last_name = updated.rows[0].last_name;
      currentUser.email = updated.rows[0].email;
      currentUser.created_at = updated.rows[0].created_at;
      currentUser.updated_at = updated.rows[0].updated_at;
    }

    if (currentUser.role === 'learner' && Object.prototype.hasOwnProperty.call(req.body, 'classId')) {
      if (!classId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'classId cannot be empty for learner updates.' });
      }

      const classRow = await client.query('SELECT id FROM classes WHERE id = $1', [classId]);
      if (classRow.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'classId does not exist.' });
      }

      await client.query(
        `INSERT INTO class_learners (class_id, learner_id)
         VALUES ($1, $2)
         ON CONFLICT (learner_id) DO UPDATE SET class_id = EXCLUDED.class_id`,
        [classId, userId]
      );
    }

    if (currentUser.role === 'teacher' && assignmentInputProvided) {
      if (normalizedAssignments.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Provide at least one class and subject assignment.' });
      }

      await replaceTeacherAssignments(client, userId, normalizedAssignments);
    }

    if (currentUser.role !== 'teacher' && assignmentInputProvided) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Only teacher assignments can be updated with class and subject groups.' });
    }

    await client.query('COMMIT');

    const refreshedUserResult = await pool.query(
      `SELECT id, role, first_name, last_name, email, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const user = buildPublicUser(refreshedUserResult.rows[0]);
    const details = await loadUserDetails(user.id, user.role);

    return res.json({ user, details });
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

usersRouter.delete('/:userId', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { userId } = req.params;

    const userResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [userId]);

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (userResult.rows[0].role === 'admin') {
      return res.status(400).json({ message: 'Admin accounts cannot be deleted from this screen.' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    return res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    return next(error);
  }
});
