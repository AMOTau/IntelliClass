import { pool } from '../config/db.js';

// Email is a best-effort side channel: a failing mailbox must never fail the
// teacher's request, so every send is settled and swallowed.
export async function deliver(tasks) {
  await Promise.allSettled(tasks);
}

function mapRecipient(row) {
  return {
    parentId: row.parent_id,
    email: row.email,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    learnerId: row.learner_id,
    childName: `${row.learner_first_name} ${row.learner_last_name}`.trim(),
  };
}

export async function teacherContact(teacherId) {
  if (!teacherId) {
    return { name: "your child's teacher", email: '', phone: '' };
  }

  const result = await pool.query(
    'SELECT first_name, last_name, email, phone FROM users WHERE id = $1',
    [teacherId]
  );
  const row = result.rows[0];
  if (!row) {
    return { name: "your child's teacher", email: '', phone: '' };
  }

  return {
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email || '',
    phone: row.phone || '',
  };
}

/** One row per parent/child pair for every learner in the class. */
export async function parentsOfClass(classId) {
  if (!classId) {
    return [];
  }

  const result = await pool.query(
    `SELECT p.id AS parent_id, p.email, p.first_name, p.last_name,
            l.id AS learner_id, l.first_name AS learner_first_name, l.last_name AS learner_last_name
     FROM class_learners cl
     JOIN users l ON l.id = cl.learner_id
     JOIN parent_learners pl ON pl.learner_id = cl.learner_id
     JOIN users p ON p.id = pl.parent_id
     WHERE cl.class_id = $1`,
    [classId]
  );

  return result.rows.map(mapRecipient);
}

export async function parentsOfLearner(learnerId) {
  if (!learnerId) {
    return [];
  }

  const result = await pool.query(
    `SELECT p.id AS parent_id, p.email, p.first_name, p.last_name,
            l.id AS learner_id, l.first_name AS learner_first_name, l.last_name AS learner_last_name
     FROM parent_learners pl
     JOIN users p ON p.id = pl.parent_id
     JOIN users l ON l.id = pl.learner_id
     WHERE pl.learner_id = $1`,
    [learnerId]
  );

  return result.rows.map(mapRecipient);
}

export async function teacherTeachesClass(teacherId, classId) {
  const result = await pool.query(
    'SELECT 1 FROM class_subject_teachers WHERE teacher_id = $1 AND class_id = $2 LIMIT 1',
    [teacherId, classId]
  );
  return result.rowCount > 0;
}

export async function teacherTeachesLearner(teacherId, learnerId) {
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
