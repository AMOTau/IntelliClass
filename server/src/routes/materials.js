import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { extractPdfText } from '../utils/pdfText.js';

export const materialsRouter = Router();

const uploadsRoot = fileURLToPath(new URL('../../uploads', import.meta.url));
const materialsUploadDir = path.join(uploadsRoot, 'materials');

if (!existsSync(materialsUploadDir)) {
  mkdirSync(materialsUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, materialsUploadDir),
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.pdf';
    callback(null, `${randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const isPdf = file.mimetype === 'application/pdf' || extension === '.pdf';

    if (!isPdf) {
      return callback(new Error('Only PDF files are supported for material uploads.'));
    }

    return callback(null, true);
  },
});

function handleUpload(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) {
      return next();
    }

    error.statusCode = 400;
    return next(error);
  });
}

function buildMaterialRow(material, { includeText = false } = {}) {
  return {
    id: material.id,
    teacherId: material.teacher_id,
    title: material.title,
    description: material.description,
    subject: material.subject,
    className: material.class_name,
    classId: material.class_id,
    subjectId: material.subject_id,
    fileName: material.file_name,
    filePath: material.file_path,
    fileUrl: `/uploads/${material.file_path}`,
    extractedText: includeText ? material.extracted_text : undefined,
    extractedTextPreview: material.extracted_text ? `${material.extracted_text.slice(0, 280)}${material.extracted_text.length > 280 ? '…' : ''}` : '',
    hasExtractedText: Boolean(material.extracted_text),
    createdAt: material.created_at,
    updatedAt: material.updated_at,
  };
}

const MATERIAL_COLUMNS = `id, teacher_id, title, description, subject, class_name, class_id, subject_id, file_name, file_path, extracted_text, created_at, updated_at`;

async function loadMaterialForUser(materialId, user) {
  const queryResult = await pool.query(`SELECT ${MATERIAL_COLUMNS} FROM materials WHERE id = $1`, [materialId]);

  if (queryResult.rowCount === 0) {
    const error = new Error('Material not found.');
    error.statusCode = 404;
    throw error;
  }

  const material = queryResult.rows[0];

  if (user.role === 'admin' || material.teacher_id === user.sub) {
    return material;
  }

  if (user.role === 'learner' && material.class_id) {
    const classAccess = await pool.query(
      `SELECT 1 FROM class_learners WHERE learner_id = $1 AND class_id = $2`,
      [user.sub, material.class_id]
    );

    if (classAccess.rowCount > 0) {
      return material;
    }
  }

  const error = new Error('You do not have permission to access this material.');
  error.statusCode = 403;
  throw error;
}

async function resolveClassAndSubject({ classId, subjectId, className, subjectName }) {
  let classRow = null;
  let subjectRow = null;

  if (classId) {
    const classResult = await pool.query('SELECT id, name FROM classes WHERE id = $1', [classId]);
    classRow = classResult.rows[0] ?? null;
  } else if (className) {
    const classResult = await pool.query('SELECT id, name FROM classes WHERE lower(name) = lower($1) LIMIT 1', [className]);
    classRow = classResult.rows[0] ?? null;
  }

  if (subjectId) {
    const subjectResult = await pool.query('SELECT id, name FROM subjects WHERE id = $1', [subjectId]);
    subjectRow = subjectResult.rows[0] ?? null;
  } else if (subjectName) {
    const subjectResult = await pool.query('SELECT id, name FROM subjects WHERE lower(name) = lower($1) LIMIT 1', [subjectName]);
    subjectRow = subjectResult.rows[0] ?? null;
  }

  return { classRow, subjectRow };
}

materialsRouter.post('/upload', requireAuth, requireRole('teacher', 'admin'), handleUpload, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'A PDF file is required.' });
    }

    const title = (req.body.title?.trim() || path.parse(req.file.originalname).name || '').trim();
    const description = req.body.description?.trim() || null;

    if (!title) {
      return res.status(400).json({ message: 'title is required.' });
    }

    const { classRow, subjectRow } = await resolveClassAndSubject({
      classId: req.body.classId,
      subjectId: req.body.subjectId,
      className: req.body.className,
      subjectName: req.body.subject,
    });

    if (!classRow || !subjectRow) {
      return res.status(400).json({ message: 'Choose a class and subject before uploading.' });
    }

    let extractedText = '';

    try {
      extractedText = await extractPdfText(req.file.path);
    } catch (parseError) {
      const error = new Error('Could not read text from this PDF. Upload a text-based PDF rather than a scanned image.');
      error.statusCode = 400;
      throw error;
    }

    const insertResult = await pool.query(
      `INSERT INTO materials (
         teacher_id, title, description, subject, class_name, class_id, subject_id, file_name, file_path, extracted_text
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${MATERIAL_COLUMNS}`,
      [
        req.user.sub,
        title,
        description,
        subjectRow.name,
        classRow.name,
        classRow.id,
        subjectRow.id,
        req.file.originalname,
        `materials/${req.file.filename}`,
        extractedText || null,
      ]
    );

    return res.status(201).json({ material: buildMaterialRow(insertResult.rows[0], { includeText: true }) });
  } catch (error) {
    if (req.file?.path) {
      try {
        await unlink(req.file.path);
      } catch {
        // ignore cleanup failures
      }
    }

    return next(error);
  }
});

materialsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    let queryResult;

    if (req.user.role === 'admin') {
      queryResult = await pool.query(`SELECT ${MATERIAL_COLUMNS} FROM materials ORDER BY created_at DESC`);
    } else if (req.user.role === 'teacher') {
      queryResult = await pool.query(`SELECT ${MATERIAL_COLUMNS} FROM materials WHERE teacher_id = $1 ORDER BY created_at DESC`, [req.user.sub]);
    } else if (req.user.role === 'learner') {
      queryResult = await pool.query(
        `SELECT ${MATERIAL_COLUMNS}
         FROM materials
         WHERE class_id IN (SELECT class_id FROM class_learners WHERE learner_id = $1)
         ORDER BY created_at DESC`,
        [req.user.sub]
      );
    } else {
      return res.status(403).json({ message: 'You do not have permission to access this resource.' });
    }

    return res.json({ materials: queryResult.rows.map((row) => buildMaterialRow(row)) });
  } catch (error) {
    return next(error);
  }
});

materialsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const material = await loadMaterialForUser(req.params.id, req.user);
    return res.json({ material: buildMaterialRow(material, { includeText: req.user.role !== 'learner' }) });
  } catch (error) {
    return next(error);
  }
});

materialsRouter.delete('/:id', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const material = await loadMaterialForUser(req.params.id, req.user);

    if (req.user.role !== 'admin' && material.teacher_id !== req.user.sub) {
      return res.status(403).json({ message: 'You do not have permission to delete this material.' });
    }

    await pool.query('DELETE FROM materials WHERE id = $1', [material.id]);

    const filePath = path.join(uploadsRoot, material.file_path);
    try {
      await unlink(filePath);
    } catch {
      // ignore missing file cleanup errors
    }

    return res.json({ message: 'Material deleted successfully.' });
  } catch (error) {
    return next(error);
  }
});
