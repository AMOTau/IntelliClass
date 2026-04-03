import app from './app.js';
import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { pool } from './config/db.js';

const schemaPath = fileURLToPath(new URL('../db/schema.sql', import.meta.url));

async function ensureSchema() {
  const schemaSql = await readFile(schemaPath, 'utf8');
  await pool.query(schemaSql);
}

async function ensureDefaultAdmin() {
  const adminCountResult = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
  if (adminCountResult.rows[0].count > 0) {
    return;
  }

  const defaultEmail = 'admin@int.com';
  const defaultPassword = 'Admin@123';

  const existingEmailResult = await pool.query('SELECT id FROM users WHERE email = $1', [defaultEmail]);
  if (existingEmailResult.rowCount > 0) {
    console.warn('Default admin email already exists but no admin role was found. Skipping automatic admin seed.');
    return;
  }

  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  await pool.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'admin')`,
    ['System', 'Administrator', defaultEmail, passwordHash]
  );

  console.log('Seeded default admin account: admin@int.com');
}

async function ensureDefaultAcademics() {
  const defaultClasses = [
    { name: 'Grade 4a', gradeLevel: 'Grade 4' },
    { name: 'Grade 4b', gradeLevel: 'Grade 4' },
    { name: 'Grade 5a', gradeLevel: 'Grade 5' },
    { name: 'Grade 5b', gradeLevel: 'Grade 5' },
    { name: 'Grade 6a', gradeLevel: 'Grade 6' },
    { name: 'Grade 6b', gradeLevel: 'Grade 6' },
  ];
  const defaultSubjects = [
    { name: 'English', code: 'ENG' },
    { name: 'Home Language', code: 'HL' },
    { name: 'Mathematics', code: 'MATH' },
    { name: 'NS Tech', code: 'NST' },
    { name: 'Social Sciences', code: 'SS' },
    { name: 'Life Skills', code: 'LS' },
  ];

  for (const classItem of defaultClasses) {
    const existingClass = await pool.query('SELECT id FROM classes WHERE name = $1', [classItem.name]);

    if (existingClass.rowCount === 0) {
      await pool.query(
        `INSERT INTO classes (name, grade_level)
         VALUES ($1, $2)`,
        [classItem.name, classItem.gradeLevel]
      );
    }
  }

  for (const subject of defaultSubjects) {
    const existingSubject = await pool.query('SELECT id FROM subjects WHERE name = $1', [subject.name]);

    if (existingSubject.rowCount === 0) {
      await pool.query(
        `INSERT INTO subjects (name, code)
         VALUES ($1, $2)`,
        [subject.name, subject.code]
      );
    }
  }
}

async function startServer() {
  try {
    await pool.query('SELECT 1');
    await ensureSchema();
    await ensureDefaultAdmin();
    await ensureDefaultAcademics();

    app.listen(env.port, () => {
      console.log(`IntelliClass API running on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error('Failed to connect to PostgreSQL or start the server.');
    console.error(error);
    process.exit(1);
  }
}

startServer();
