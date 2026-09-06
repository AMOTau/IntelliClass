import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

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

let pdfParseLoader;

async function parsePdfBuffer(buffer) {
  if (!pdfParseLoader) {
    const pdfModule = await import('pdf-parse');
    pdfParseLoader = pdfModule.default ?? pdfModule;
  }

  return pdfParseLoader(buffer);
}

function buildMaterialRow(material) {
  return {
    id: material.id,
    teacherId: material.teacher_id,
    title: material.title,
    description: material.description,
    subject: material.subject,
    className: material.class_name,
    fileName: material.file_name,
    filePath: material.file_path,
    fileUrl: `/uploads/${material.file_path}`,
    extractedText: material.extracted_text,
    createdAt: material.created_at,
    updatedAt: material.updated_at,
  };
}

async function loadMaterialForUser(materialId, user) {
  const queryResult = await pool.query(
    `SELECT id, teacher_id, title, description, subject, class_name, file_name, file_path, extracted_text, created_at, updated_at
     FROM materials
     WHERE id = $1`,
    [materialId]
  );

  if (queryResult.rowCount === 0) {
    const error = new Error('Material not found.');
    error.statusCode = 404;
    throw error;
  }

  const material = queryResult.rows[0];

  if (user.role !== 'admin' && material.teacher_id !== user.sub) {
    const error = new Error('You do not have permission to access this material.');
    error.statusCode = 403;
    throw error;
  }

  return material;
}

materialsRouter.post('/upload', requireAuth, requireRole('teacher', 'admin'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'A PDF file is required.' });
    }

    const title = (req.body.title?.trim() || path.parse(req.file.originalname).name || '').trim();
    const description = req.body.description?.trim() || null;
    const subject = req.body.subject?.trim() || null;
    const className = req.body.className?.trim() || null;

    if (!title) {
      return res.status(400).json({ message: 'title is required.' });
    }

    let extractedText = null;

    if (req.file.mimetype === 'application/pdf' || path.extname(req.file.originalname).toLowerCase() === '.pdf') {
      const fileBuffer = await readFile(req.file.path);
      const parsedPdf = await parsePdfBuffer(fileBuffer);
      extractedText = parsedPdf.text?.trim() || null;
    }

    const insertResult = await pool.query(
      `INSERT INTO materials (
         teacher_id,
         title,
         description,
         subject,
         class_name,
         file_name,
         file_path,
         extracted_text
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, teacher_id, title, description, subject, class_name, file_name, file_path, extracted_text, created_at, updated_at`,
      [req.user.sub, title, description, subject, className, req.file.originalname, `materials/${req.file.filename}`, extractedText]
    );

    return res.status(201).json({ material: buildMaterialRow(insertResult.rows[0]) });
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

materialsRouter.get('/', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const queryResult = isAdmin
      ? await pool.query(
          `SELECT id, teacher_id, title, description, subject, class_name, file_name, file_path, extracted_text, created_at, updated_at
           FROM materials
           ORDER BY created_at DESC`
        )
      : await pool.query(
          `SELECT id, teacher_id, title, description, subject, class_name, file_name, file_path, extracted_text, created_at, updated_at
           FROM materials
           WHERE teacher_id = $1
           ORDER BY created_at DESC`,
          [req.user.sub]
        );

    return res.json({ materials: queryResult.rows.map(buildMaterialRow) });
  } catch (error) {
    return next(error);
  }
});

materialsRouter.get('/:id', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const material = await loadMaterialForUser(req.params.id, req.user);

    return res.json({ material: buildMaterialRow(material) });
  } catch (error) {
    return next(error);
  }
});

materialsRouter.delete('/:id', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const material = await loadMaterialForUser(req.params.id, req.user);

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