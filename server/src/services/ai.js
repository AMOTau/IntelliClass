import { generateExplanation, generateQuiz } from './quizAi/index.js';
import { canonicalDifficulty } from './quizAi/questionValidator.js';

export { generateQuiz } from './quizAi/index.js';
export { MAX_AI_QUESTIONS, MIN_AI_QUESTIONS } from './quizAi/index.js';

export const LEARNER_TEMPLATES = ['classic', 'drag_drop', 'tap_match', 'adventure'];

export function normalizeLearnerTemplate(value) {
  const template = String(value || 'classic').trim().toLowerCase();
  return LEARNER_TEMPLATES.includes(template) ? template : 'classic';
}

// Lenient normaliser for questions typed or edited by teachers.
export function normalizeQuestions(questions) {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions
    .map((question, index) => {
      const questionText = question?.questionText ?? question?.question ?? '';
      const options = Array.isArray(question?.options) ? question.options.map((option) => String(option).trim()).filter(Boolean) : [];
      const uniqueOptions = [...new Set(options)].slice(0, 6);
      const correctAnswer = String(question?.correctAnswer ?? question?.correct_answer ?? '').trim();
      const matchedCorrect = uniqueOptions.find((option) => option.toLowerCase() === correctAnswer.toLowerCase()) ?? uniqueOptions[0];

      if (!String(questionText).trim() || uniqueOptions.length < 2 || !matchedCorrect) {
        return null;
      }

      while (uniqueOptions.length < 4) {
        uniqueOptions.push(`Option ${uniqueOptions.length + 1}`);
      }

      return {
        questionText: String(questionText).trim(),
        options: uniqueOptions,
        correctAnswer: matchedCorrect,
        explanation: String(question?.explanation ?? '').trim() || null,
        difficulty: canonicalDifficulty(question?.difficulty),
        topic: String(question?.topic ?? '').trim() || null,
        questionOrder: Number.isInteger(question?.questionOrder) ? question.questionOrder : index + 1,
      };
    })
    .filter(Boolean);
}

export function generateQuizFromMaterial(options) {
  return generateQuiz(options);
}

export function generateAnswerExplanation({
  questionText,
  options,
  selectedAnswer,
  correctAnswer,
  materialText,
  topic,
  storedExplanation,
  enrichWithAi,
}) {
  return generateExplanation({
    questionText,
    options,
    selectedAnswer,
    correctAnswer,
    knowledgeText: materialText,
    topic,
    storedExplanation,
    enrichWithAi,
  });
}
