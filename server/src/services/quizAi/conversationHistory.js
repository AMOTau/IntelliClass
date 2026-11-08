// Layer 3 — conversation history.
// Every generation for a quiz is stored as a teacher turn plus an assistant
// turn, so later requests can refine the quiz and avoid repeating questions.
import { pool } from '../../config/db.js';

// Keep history short — long replays dominate latency with Flash-Lite.
const MAX_TURN_PAIRS = 2;

export async function recordHistoryTurn(db, { quizId, teacherId, role, content, metadata = {} }) {
  await (db || pool).query(
    `INSERT INTO quiz_ai_messages (quiz_id, teacher_id, role, content, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [quizId, teacherId ?? null, role, content, JSON.stringify(metadata)]
  );
}

export async function recordGenerationExchange(db, { quizId, teacherId, request, result }) {
  await recordHistoryTurn(db, {
    quizId,
    teacherId,
    role: 'teacher',
    content: request.instructions || (request.mode === 'append' ? 'Add more questions.' : 'Generate the quiz.'),
    metadata: {
      mode: request.mode,
      questionCount: request.questionCount,
      difficultyMix: request.difficultyMix,
      learnerTemplate: request.learnerTemplate,
      scope: request.scope,
      scopeDescription: request.scopeDescription,
    },
  });

  await recordHistoryTurn(db, {
    quizId,
    teacherId,
    role: 'assistant',
    content: `Created ${result.questions.length} questions (${result.source === 'huggingface' ? 'AI' : 'built from the notes without AI'}).`,
    metadata: {
      source: result.source,
      model: result.model || null,
      warning: result.warning || null,
      questions: result.questions.map((question) => ({
        questionText: question.questionText,
        correctAnswer: question.correctAnswer,
        difficulty: question.difficulty,
        topic: question.topic,
      })),
    },
  });
}

export async function loadHistory(quizId) {
  const result = await pool.query(
    `SELECT id, role, content, metadata, created_at
     FROM quiz_ai_messages
     WHERE quiz_id = $1
     ORDER BY created_at ASC, id ASC`,
    [quizId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  }));
}

export function previousQuestionTexts(history) {
  return history
    .filter((turn) => turn.role === 'assistant')
    .flatMap((turn) => (turn.metadata?.questions || []).map((question) => question.questionText))
    .filter(Boolean);
}

export function countAssistantTurns(history) {
  return history.filter((turn) => turn.role === 'assistant').length;
}

// Only complete teacher → assistant pairs are replayed, which keeps the
// user/assistant alternation that chat providers require.
export function buildHistoryMessages(history) {
  const pairs = [];
  for (let index = 0; index < history.length - 1; index += 1) {
    const teacher = history[index];
    const assistant = history[index + 1];
    if (teacher.role === 'teacher' && assistant.role === 'assistant') {
      pairs.push([teacher, assistant]);
      index += 1;
    }
  }

  return pairs.slice(-MAX_TURN_PAIRS).flatMap(([teacher, assistant]) => {
    const questions = assistant.metadata?.questions || [];
    const scope = teacher.metadata?.scopeDescription ? ` (content: ${teacher.metadata.scopeDescription})` : '';
    return [
      { role: 'user', content: `Earlier teacher request${scope}: ${teacher.content}` },
      {
        role: 'assistant',
        content: questions.length
          ? `I wrote these questions:\n${questions.map((question) => `- [${question.difficulty}] ${question.questionText} → ${question.correctAnswer}`).join('\n')}`
          : assistant.content,
      },
    ];
  });
}
