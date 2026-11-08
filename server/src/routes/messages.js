import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  parentsOfClass,
  parentsOfLearner,
  teacherTeachesClass,
  teacherTeachesLearner,
} from '../utils/notify.js';

export const messagesRouter = Router();

function mapMessage(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    teacherId: row.teacher_id,
    teacherName: row.teacher_first_name
      ? `${row.teacher_first_name} ${row.teacher_last_name}`.trim()
      : row.teacher_name,
    teacherEmail: row.teacher_email || null,
    teacherPhone: row.teacher_phone || null,
    parentId: row.parent_id,
    parentName: row.parent_first_name ? `${row.parent_first_name} ${row.parent_last_name}`.trim() : undefined,
    learnerId: row.learner_id,
    childName: row.learner_first_name ? `${row.learner_first_name} ${row.learner_last_name}`.trim() : undefined,
    classId: row.class_id,
    className: row.class_name || undefined,
    parentReply: row.parent_reply || null,
    parentRepliedAt: row.parent_replied_at || null,
  };
}

const MESSAGE_SELECT = `
  m.id, m.title, m.body, m.created_at, m.teacher_id, m.parent_id, m.learner_id, m.class_id,
  m.parent_reply, m.parent_replied_at,
  t.first_name AS teacher_first_name, t.last_name AS teacher_last_name,
  t.email AS teacher_email, t.phone AS teacher_phone,
  l.first_name AS learner_first_name, l.last_name AS learner_last_name,
  c.name AS class_name
`;

messagesRouter.get('/', requireAuth, requireRole('teacher', 'admin', 'parent'), async (req, res, next) => {
  try {
    if (req.user.role === 'parent') {
      const result = await pool.query(
        `SELECT ${MESSAGE_SELECT}
         FROM parent_messages m
         JOIN users t ON t.id = m.teacher_id
         LEFT JOIN users l ON l.id = m.learner_id
         LEFT JOIN classes c ON c.id = m.class_id
         WHERE m.parent_id = $1
         ORDER BY m.created_at DESC
         LIMIT 50`,
        [req.user.sub]
      );
      return res.json({ messages: result.rows.map(mapMessage) });
    }

    const result = await pool.query(
      `SELECT ${MESSAGE_SELECT},
              p.first_name AS parent_first_name, p.last_name AS parent_last_name
       FROM parent_messages m
       JOIN users t ON t.id = m.teacher_id
       JOIN users p ON p.id = m.parent_id
       LEFT JOIN users l ON l.id = m.learner_id
       LEFT JOIN classes c ON c.id = m.class_id
       WHERE m.teacher_id = $1 OR $2 = 'admin'
       ORDER BY COALESCE(m.parent_replied_at, m.created_at) DESC
       LIMIT 50`,
      [req.user.sub, req.user.role]
    );
    return res.json({ messages: result.rows.map(mapMessage) });
  } catch (error) {
    return next(error);
  }
});

messagesRouter.post('/', requireAuth, requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    const body = String(req.body.body || '').trim();
    const learnerId = req.body.learnerId || null;
    const classId = req.body.classId || null;

    if (!title || !body) {
      return res.status(400).json({ message: 'Please write a short subject and a message.' });
    }
    if (title.length > 160 || body.length > 4000) {
      return res.status(400).json({ message: 'That message is a little long. Please shorten it.' });
    }
    if (!learnerId && !classId) {
      return res.status(400).json({ message: 'Choose a class, or a specific child.' });
    }

    if (req.user.role !== 'admin') {
      if (learnerId && !(await teacherTeachesLearner(req.user.sub, learnerId))) {
        return res.status(403).json({ message: 'You do not teach this learner.' });
      }
      if (classId && !(await teacherTeachesClass(req.user.sub, classId))) {
        return res.status(403).json({ message: 'You are not assigned to that class.' });
      }
    }

    const recipients = learnerId ? await parentsOfLearner(learnerId) : await parentsOfClass(classId);
    if (recipients.length === 0) {
      return res.status(400).json({ message: 'No parents are linked to that learner or class yet.' });
    }

    // In-app only — parents see these as IntelliClass notifications / Teacher notes.
    // Skipping email keeps send responsive for class-wide notes.
    const inserted = [];

    for (const recipient of recipients) {
      const saved = await pool.query(
        `INSERT INTO parent_messages (teacher_id, parent_id, learner_id, class_id, title, body)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [req.user.sub, recipient.parentId, recipient.learnerId, classId, title, body]
      );
      inserted.push({ ...recipient, id: saved.rows[0].id, createdAt: saved.rows[0].created_at });
    }

    return res.status(201).json({
      sent: inserted.length,
      message: `Note sent to ${inserted.length} parent${inserted.length === 1 ? '' : 's'} on IntelliClass.`,
    });
  } catch (error) {
    return next(error);
  }
});

messagesRouter.post('/:messageId/reply', requireAuth, requireRole('parent'), async (req, res, next) => {
  try {
    const reply = String(req.body.body || req.body.reply || '').trim();
    if (!reply) {
      return res.status(400).json({ message: 'Please write a short reply.' });
    }
    if (reply.length > 4000) {
      return res.status(400).json({ message: 'That reply is a little long. Please shorten it.' });
    }

    const existing = await pool.query(
      `SELECT id FROM parent_messages WHERE id = $1 AND parent_id = $2`,
      [req.params.messageId, req.user.sub]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'That note could not be found.' });
    }

    const result = await pool.query(
      `UPDATE parent_messages
       SET parent_reply = $1, parent_replied_at = now()
       WHERE id = $2 AND parent_id = $3
       RETURNING id, parent_reply, parent_replied_at`,
      [reply, req.params.messageId, req.user.sub]
    );

    return res.json({
      message: 'Reply sent to the teacher on IntelliClass.',
      reply: {
        id: result.rows[0].id,
        parentReply: result.rows[0].parent_reply,
        parentRepliedAt: result.rows[0].parent_replied_at,
      },
    });
  } catch (error) {
    return next(error);
  }
});
