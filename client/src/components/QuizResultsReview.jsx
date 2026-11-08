import { useMemo, useState } from 'react';

function scoreRing(percent) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return { value, circumference, offset };
}

function skillKey(topic) {
  const label = String(topic || '').trim();
  return label || 'This quiz';
}

function buildSkills(results) {
  const groups = new Map();
  (results || []).forEach((result) => {
    const key = skillKey(result.topic);
    const current = groups.get(key) || { topic: key, correct: 0, total: 0 };
    current.total += 1;
    if (result.isCorrect) {
      current.correct += 1;
    }
    groups.set(key, current);
  });
  return [...groups.values()];
}

function buildTakeaway(skills, childLabel) {
  const weak = skills.filter((skill) => skill.correct < skill.total);
  const strong = skills.filter((skill) => skill.correct === skill.total && skill.total > 0);
  if (weak.length === 0) {
    return `${childLabel} did well across this quiz. Sit together to celebrate, then keep the same habits going.`;
  }
  const weakNames = weak.map((skill) => skill.topic).join(', ');
  if (strong.length) {
    return `${strong[0].topic} is solid. ${weakNames} still need more practice — talk through the missed questions below.`;
  }
  return `${weakNames} need more practice. Work through the missed questions together, then retry similar examples from the notes.`;
}

function formatTakenAt(value) {
  if (!value) {
    return 'Not recorded';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Not recorded';
  }
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function ScoreRing({ percent }) {
  const { value, circumference, offset } = scoreRing(percent);
  return (
    <div className="ic-result-ring" aria-label={`Score ${value}%`}>
      <svg viewBox="0 0 88 88" className="ic-result-ring-svg">
        <circle className="ic-result-ring-track" cx="44" cy="44" r="34" />
        <circle
          className="ic-result-ring-value"
          cx="44"
          cy="44"
          r="34"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="ic-result-ring-label">{value}%</span>
    </div>
  );
}

export default function QuizResultsReview({
  title,
  className,
  subjectName,
  childName,
  teacherName,
  takenAt,
  score,
  correctCount,
  totalQuestions,
  results = [],
  explanations = {},
  explainingId = '',
  onExplain,
  onBack,
  onMessageTeacher,
  viewer = 'learner',
}) {
  const [filter, setFilter] = useState('all');
  const skills = useMemo(() => buildSkills(results), [results]);
  const childLabel = childName || (viewer === 'parent' ? 'Your child' : 'You');
  const needsPractice = results.filter((result) => !result.isCorrect).length;
  const correctOnly = results.filter((result) => result.isCorrect).length;
  const visible = results.filter((result) => {
    if (filter === 'practice') return !result.isCorrect;
    if (filter === 'correct') return result.isCorrect;
    return true;
  });
  const takeaway = buildTakeaway(skills, childLabel);
  const isParent = viewer === 'parent';

  return (
    <div className="ic-results">
      <p className="ic-results-crumb">
        <button type="button" onClick={onBack} className="ic-results-crumb-link">Quizzes</button>
        <span aria-hidden="true"> / </span>
        <span>{title}</span>
      </p>

      <section className="ic-results-hero">
        <ScoreRing percent={score} />
        <div className="ic-results-hero-copy">
          <h1 className="ic-results-title">{title}</h1>
          <p className="ic-results-meta">
            {childName || className || subjectName || 'Quiz'}
            {takenAt ? ` · Taken ${formatTakenAt(takenAt)}` : ''}
            {` · ${correctCount} of ${totalQuestions} correct`}
          </p>
          <div className="ic-results-takeaway">
            <p className="ic-results-takeaway-label">Takeaway</p>
            <p>{takeaway}</p>
          </div>
        </div>
      </section>

      {skills.length > 0 ? (
        <section>
          <h2 className="ic-results-section-title">Skills breakdown</h2>
          <div className="ic-results-skills">
            {skills.map((skill) => {
              const ratio = skill.total ? skill.correct / skill.total : 0;
              return (
                <article key={skill.topic} className="ic-results-skill">
                  <p className="ic-results-skill-name">{skill.topic}</p>
                  <p className="ic-results-skill-count">{skill.correct} / {skill.total}</p>
                  <div className="ic-results-skill-bar" aria-hidden="true">
                    <span
                      className={ratio === 1 ? 'is-ok' : 'is-weak'}
                      style={{ width: `${Math.max(8, ratio * 100)}%` }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="ic-results-filters">
        {[
          ['all', `All (${results.length})`],
          ['practice', `Needs practice (${needsPractice})`],
          ['correct', `Correct (${correctOnly})`],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`ic-results-chip ${filter === value ? 'is-active' : ''}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="ic-results-questions">
        {visible.map((result, index) => {
          const number = (results.findIndex((item) => item.questionId === result.questionId) + 1) || index + 1;
          const explanation = explanations[result.questionId];
          const why = result.isCorrect
            ? ''
            : String(
              viewer === 'learner'
                ? (explanation?.explanation || result.explanation || '')
                : (result.explanation || explanation?.explanation || '')
            ).trim();
          const tip = viewer === 'learner' && !result.isCorrect
            ? String(explanation?.studySuggestion || '').trim()
            : '';

          if (result.isCorrect) {
            return (
              <article key={result.questionId} className="ic-results-q ic-results-q--ok">
                <p className="ic-results-q-kicker">
                  <span className="ic-results-mark is-ok" aria-hidden="true">✓</span>
                  Question {number} · Correct
                </p>
                <div className="ic-results-q-row">
                  <p className="ic-results-q-text">{result.questionText}</p>
                  <p className="ic-results-q-answer">{result.correctAnswer}</p>
                </div>
              </article>
            );
          }

          return (
            <article key={result.questionId} className="ic-results-q ic-results-q--miss">
              <div className="ic-results-q-head">
                <p className="ic-results-q-kicker is-miss">
                  <span className="ic-results-mark is-miss" aria-hidden="true">×</span>
                  Question {number} · Needs practice
                </p>
                {result.topic ? <p className="ic-results-q-topic">{result.topic}</p> : null}
              </div>
              <p className="ic-results-q-text">{result.questionText}</p>
              <div className="ic-results-answers">
                <div className="ic-results-answer is-chosen">
                  <p className="ic-results-answer-label">{isParent ? `${childLabel}’s answer` : 'Your answer'}</p>
                  <p>{result.selectedAnswer || 'Not answered'}</p>
                </div>
                <div className="ic-results-answer is-correct">
                  <p className="ic-results-answer-label">Correct answer</p>
                  <p>{result.correctAnswer}</p>
                </div>
              </div>
              {why ? <p className="ic-results-why"><strong>Why:</strong> {why}</p> : null}
              {tip ? <p className="ic-results-tip">{tip}</p> : null}
              {viewer === 'learner' && onExplain ? (
                <button
                  type="button"
                  onClick={() => onExplain(result.questionId)}
                  disabled={explainingId === result.questionId}
                  className="ic-btn-primary mt-3 text-sm disabled:opacity-60"
                >
                  {explainingId === result.questionId
                    ? 'Asking AI tutor…'
                    : explanation?.source === 'ai' || explanation?.source === 'cached'
                      ? 'Refresh AI tip'
                      : 'Ask AI tutor for more'}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>

      {isParent ? (
        <section className="ic-results-footer">
          <p>
            Ready to improve? Practise the {skills.filter((skill) => skill.correct < skill.total).length || needsPractice} skill{skills.filter((skill) => skill.correct < skill.total).length === 1 ? '' : 's'} marked above
            {teacherName ? `, or send ${teacherName} a note about this quiz.` : ', or send the teacher a note about this quiz.'}
          </p>
          {onMessageTeacher ? (
            <button type="button" className="ic-results-footer-btn" onClick={onMessageTeacher}>
              Message teacher
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
