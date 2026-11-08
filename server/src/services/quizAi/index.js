// Quiz generation pipeline:
//   1. system instruction  (systemInstructions.js)
//   2. knowledge base       (knowledgeBase.js)
//   3. conversation history (conversationHistory.js)
// followed by validation, optional repair, and an offline fallback.
import { chatCompletion, describeAiFailure, extractJson } from './llmClient.js';
import { buildKnowledgeContext, describeScope, retrieveRelevantExcerpts } from './knowledgeBase.js';
import { buildHistoryMessages, countAssistantTurns, previousQuestionTexts } from './conversationHistory.js';
import { buildLocalQuestions } from './localGenerator.js';
import { fitToPlan, missingPlan, validateGeneratedQuestions } from './questionValidator.js';
import {
  buildDifficultyPlan,
  buildGenerationRequest,
  buildKnowledgeMessage,
  buildRepairRequest,
  buildSystemInstruction,
  normalizeDifficultyMix,
} from './systemInstructions.js';

export const MIN_AI_QUESTIONS = 1;
export const MAX_AI_QUESTIONS = 20;

function clampCount(value) {
  return Math.min(Math.max(Number(value) || 8, MIN_AI_QUESTIONS), MAX_AI_QUESTIONS);
}

function parseQuestions(content) {
  const parsed = extractJson(content);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  return parsed?.questions ?? [];
}

function compactAssistantReply(questions) {
  return JSON.stringify({ questions: questions.map(({ questionText, options, correctAnswer, difficulty }) => ({ questionText, options, correctAnswer, difficulty })) });
}

function tokensForQuestions(count) {
  // Flash-Lite is fast; keep the output budget tight so generation finishes sooner.
  return Math.min(3600, 260 * Math.max(1, count) + 280);
}

function shouldRepair(plan, accepted, count) {
  if (accepted.length >= count) {
    return false;
  }
  // Skip a second model call when we already have most of the quiz — fill gaps locally.
  const threshold = Math.max(count - 1, Math.ceil(count * 0.75));
  if (accepted.length >= threshold) {
    return false;
  }
  return missingPlan(plan, accepted).length > 0;
}

/**
 * scope: [{ material: { id, title }, chapters, chapterIds }]
 * history: rows from conversationHistory.loadHistory (may be empty)
 */
export async function generateQuiz({
  scope,
  className,
  subjectName,
  questionCount,
  learnerTemplate = 'classic',
  difficultyMix = 'balanced',
  instructions = '',
  history = [],
  existingQuestions = [],
  mode = 'replace',
}) {
  const count = clampCount(questionCount);
  const mix = normalizeDifficultyMix(difficultyMix);
  const plan = buildDifficultyPlan(count, mix);
  const rotation = countAssistantTurns(history);
  const knowledge = buildKnowledgeContext(scope, { rotation, focus: instructions, budgetChars: 9000 });

  if (!knowledge.text.trim()) {
    const error = new Error('The selected study material has no readable text. Upload a text-based PDF, not a scanned image.');
    error.statusCode = 400;
    throw error;
  }

  const scopeDescription = describeScope(knowledge.sources);
  const avoid = [...previousQuestionTexts(history), ...existingQuestions.map((question) => question.questionText)];

  const messages = [
    { role: 'system', content: buildSystemInstruction({ learnerTemplate, className, subjectName }) },
    { role: 'user', content: buildKnowledgeMessage({ knowledgeText: knowledge.text, scopeDescription }) },
    { role: 'assistant', content: 'Understood. I will write questions only from this knowledge base.' },
    ...buildHistoryMessages(history),
    { role: 'user', content: buildGenerationRequest({ count, plan, instructions, avoidQuestions: avoid, mode }) },
  ];

  let accepted = [];
  let model = null;
  let aiError = null;

  try {
    const first = await chatCompletion(messages, { maxTokens: tokensForQuestions(count), temperature: 0.35 });
    model = first.model;
    const firstPass = validateGeneratedQuestions(parseQuestions(first.content), { knowledgeText: knowledge.fullText, avoid });
    accepted = firstPass.accepted;

    if (shouldRepair(plan, accepted, count)) {
      const missing = missingPlan(plan, accepted);
      const repair = await chatCompletion(
        [
          ...messages,
          { role: 'assistant', content: compactAssistantReply(accepted) },
          {
            role: 'user',
            content: buildRepairRequest({
              missingPlan: missing,
              problems: firstPass.problems.length ? firstPass.problems : ['Not enough questions were returned for the difficulty plan.'],
            }),
          },
        ],
        { maxTokens: tokensForQuestions(missing.reduce((sum, level) => sum + level.count, 0)), temperature: 0.35 }
      );
      const secondPass = validateGeneratedQuestions(parseQuestions(repair.content), {
        knowledgeText: knowledge.fullText,
        avoid: [...avoid, ...accepted.map((question) => question.questionText)],
      });
      accepted = [...accepted, ...secondPass.accepted];
    }
  } catch (error) {
    aiError = error;
  }

  accepted = fitToPlan(plan, accepted, count);
  let source = 'ai';
  let warning = null;

  if (accepted.length < count) {
    const local = validateGeneratedQuestions(
      buildLocalQuestions({
        scope,
        plan: missingPlan(plan, accepted),
        avoid: [...avoid, ...accepted.map((question) => question.questionText)],
      }),
      { knowledgeText: knowledge.fullText, avoid: [...avoid, ...accepted.map((question) => question.questionText)] }
    ).accepted;

    if (accepted.length === 0) {
      source = 'local-fallback';
      warning = aiError
        ? `${describeAiFailure(aiError)} These questions were built directly from the notes instead — please review them before publishing.`
        : 'The AI did not return usable questions, so these were built directly from the notes. Please review them before publishing.';
    } else if (local.length) {
      source = 'mixed';
      warning = `${local.length} question(s) were added straight from the notes because the AI returned too few usable ones.`;
    }

    accepted = [...accepted, ...local].slice(0, count);
  }

  if (accepted.length === 0) {
    const error = new Error(aiError ? describeAiFailure(aiError) : 'Could not build questions from the selected content. Try selecting more chapters.');
    error.statusCode = aiError?.statusCode && aiError.statusCode < 500 ? aiError.statusCode : 502;
    throw error;
  }

  return {
    questions: accepted.map((question, index) => ({ ...question, questionOrder: index + 1 })),
    source,
    model,
    warning,
    plan,
    difficultyMix: mix,
    scopeDescription,
    sources: knowledge.sources,
  };
}

export function buildInstantExplanation({ questionText, selectedAnswer, correctAnswer, storedExplanation, topic }) {
  const tip = topic
    ? `Re-read “${topic}” in your notes, then say the main idea in one sentence.`
    : 'Re-read the matching part of your notes, then try a similar question.';

  const why = String(storedExplanation || '').trim()
    || `The notes point to “${correctAnswer}” for this question.`;

  return {
    explanation: [
      `Good try! “${selectedAnswer || 'No answer'}” was not the best fit.`,
      `The correct answer is “${correctAnswer}”.`,
      why,
    ].join(' '),
    studySuggestion: tip,
    source: 'instant',
  };
}

export async function generateExplanation({
  questionText,
  options,
  selectedAnswer,
  correctAnswer,
  knowledgeText,
  topic,
  storedExplanation = '',
  enrichWithAi = true,
}) {
  if (!enrichWithAi) {
    return buildInstantExplanation({ questionText, selectedAnswer, correctAnswer, storedExplanation, topic });
  }

  const excerpts = retrieveRelevantExcerpts(knowledgeText, `${questionText} ${correctAnswer} ${topic || ''}`, 1600);

  const messages = [
    {
      role: 'system',
      content: 'You are a brief tutor. Reply with JSON only: {"explanation":"...","studySuggestion":"..."}. Use 3-5 short sentences total. Prefer the study notes.',
    },
    {
      role: 'user',
      content: [
        `Q: ${questionText}`,
        `Chose: ${selectedAnswer || 'no answer'} | Correct: ${correctAnswer}`,
        topic ? `Topic: ${topic}` : '',
        storedExplanation ? `Teacher note: ${storedExplanation}` : '',
        excerpts ? `Notes:\n${excerpts}` : '',
        'Explain kindly why the correct answer fits. One study tip.',
      ].filter(Boolean).join('\n'),
    },
  ];

  try {
    const { content } = await chatCompletion(messages, { maxTokens: 420, temperature: 0.25 });
    const parsed = extractJson(content) || {};
    return {
      explanation: String(parsed.explanation || content).trim(),
      studySuggestion: String(parsed.studySuggestion || parsed.study_suggestion || '').trim()
        || `Re-read the notes on ${topic || 'this topic'} and explain the idea out loud in your own words.`,
      source: 'ai',
    };
  } catch {
    return buildInstantExplanation({ questionText, selectedAnswer, correctAnswer, storedExplanation, topic });
  }
}
