import app from './app.js';
import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { activeProvider, activeProviderId } from './services/quizAi/llmClient.js';

const schemaPath = fileURLToPath(new URL('../db/schema.sql', import.meta.url));

async function ensureSchema() {
  const schemaSql = await readFile(schemaPath, 'utf8');
  await pool.query(schemaSql);
}

async function ensureDefaultAdmin() {
  const defaultEmail = 'admin@int.com';
  const defaultPassword = 'Admin@123';
  const resetRequested = process.env.RESET_DEFAULT_ADMIN === 'true';

  const existing = await pool.query(
    'SELECT id, role FROM users WHERE lower(email) = $1',
    [defaultEmail]
  );

  if (existing.rowCount === 0) {
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    await pool.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin')`,
      ['System', 'Administrator', defaultEmail, passwordHash]
    );
    console.log('Seeded default admin account: admin@int.com / Admin@123');
    return;
  }

  if (existing.rows[0].role !== 'admin') {
    await pool.query("UPDATE users SET role = 'admin', updated_at = now() WHERE id = $1", [existing.rows[0].id]);
    console.log('Updated admin@int.com to the admin role.');
  }

  if (resetRequested) {
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
      [passwordHash, existing.rows[0].id]
    );
    console.log('Reset default admin password to Admin@123. Remove RESET_DEFAULT_ADMIN from Render after login.');
    return;
  }

  console.log('Default admin already exists. Sign in as admin@int.com (set RESET_DEFAULT_ADMIN=true on Render to reset the password).');
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

  const classCount = await pool.query('SELECT COUNT(*)::int AS count FROM classes');
  const subjectCount = await pool.query('SELECT COUNT(*)::int AS count FROM subjects');
  console.log(`Academics ready: ${classCount.rows[0].count} classes, ${subjectCount.rows[0].count} subjects.`);
}

async function startServer() {
  try {
    await pool.query('SELECT 1');
    await ensureSchema();
    await ensureDefaultAdmin();
    await ensureDefaultAcademics();

    app.listen(env.port, () => {
      console.log(`IntelliClass API running on http://localhost:${env.port}`);
      const provider = activeProvider();
      const token = provider.token() || '';
      if (!token) {
        console.warn(`AI provider "${activeProviderId()}" has no API key — quiz generation will use the offline notes fallback. Set GEMINI_API_KEY (recommended, free) at https://aistudio.google.com/apikey.`);
      } else {
        console.log(`AI provider: ${provider.name} (…${token.slice(-4)})`);
      }
    });
  } catch (error) {
    console.error('Failed to connect to PostgreSQL or start the server.');
    console.error(error);
    process.exit(1);
  }
}

startServer();


