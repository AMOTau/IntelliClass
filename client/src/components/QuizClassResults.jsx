function scoreTone(score) {
  if (score >= 70) return 'ok';
  if (score >= 50) return 'warn';
  return 'danger';
}

function SkillList({ title, items, empty, tone }) {
  return (
    <div className={`ic-class-skill ic-class-skill--${tone}`}>
      <p className="ic-class-skill-title">{title}</p>
      {items.length === 0 ? (
        <p className="ic-class-skill-empty">{empty}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.topic}>
              <span>{item.topic}</span>
              <strong>{item.accuracy}%</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function QuizClassResults({
  data,
  loading,
  onReviewLearner,
}) {
  if (loading) {
    return (
      <section className="ic-panel">
        <p className="text-sm text-slate-500">Loading class results…</p>
      </section>
    );
  }

  if (!data) {
    return null;
  }

  const { summary, submissions, pending, strengths, weaknesses, questions } = data;

  return (
    <section className="ic-class-results">
      <div className="ic-class-results-head">
        <div>
          <p className="ic-results-takeaway-label">Class results</p>
          <h2 className="ic-class-results-title">How the class did</h2>
        </div>
        <div className="ic-class-stats">
          <div>
            <p>{summary.submittedCount}</p>
            <span>Submitted</span>
          </div>
          <div>
            <p>{summary.pendingCount}</p>
            <span>Not yet</span>
          </div>
          <div>
            <p>{summary.averageScore == null ? '—' : `${summary.averageScore}%`}</p>
            <span>Average</span>
          </div>
        </div>
      </div>

      <div className="ic-class-skill-grid">
        <SkillList
          title="Where they excel"
          items={strengths}
          empty="Not enough answers yet to name a strength."
          tone="ok"
        />
        <SkillList
          title="Where they struggle"
          items={weaknesses.filter((item) => item.accuracy < 80)}
          empty="No weak topics yet — wait for a few more submissions."
          tone="warn"
        />
      </div>

      {questions.length ? (
        <div className="ic-class-missed">
          <p className="ic-class-skill-title">Questions most of the class missed</p>
          <ul>
            {questions.filter((question) => (question.accuracy ?? 100) < 80).slice(0, 5).map((question) => (
              <li key={question.questionId}>
                <span>Q{question.questionOrder}. {question.questionText}</span>
                <strong>{question.correct}/{question.attempts} correct</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="ic-class-people">
        <div>
          <p className="ic-class-skill-title">Submitted</p>
          {submissions.length === 0 ? (
            <p className="ic-class-skill-empty">No one has handed this quiz in yet.</p>
          ) : (
            <ul className="ic-class-roster">
              {submissions.map((row) => (
                <li key={row.learnerId}>
                  <div>
                    <p className="ic-class-name">{row.firstName} {row.lastName}</p>
                    <p className="ic-class-meta">
                      {row.correctCount}/{row.totalQuestions} correct
                      {row.submittedAt ? ` · ${new Date(row.submittedAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="ic-class-roster-actions">
                    <span className={`ic-class-score is-${scoreTone(row.score)}`}>{row.score}%</span>
                    {onReviewLearner ? (
                      <button type="button" className="ic-btn-soft text-sm" onClick={() => onReviewLearner(row)}>
                        Review
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {pending.length ? (
          <div>
            <p className="ic-class-skill-title">Still to submit</p>
            <ul className="ic-class-pending">
              {pending.map((row) => (
                <li key={row.learnerId}>{row.firstName} {row.lastName}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
