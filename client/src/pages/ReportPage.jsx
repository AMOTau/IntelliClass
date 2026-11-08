import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardShell, {
  AlertBanner,
  EmptyState,
  PageHeader,
  Panel,
  RowCard,
  StatGrid,
} from '../components/ui/DashboardShell';
import {
  IconHomework,
  IconQuizzes,
  IconReports,
} from '../components/ui/DashIcons';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { dashboardPathForRole, tabsForRole } from '../utils/dashNav';
import { formatDueDate } from '../utils/dates';
import { parseApiError } from '../utils/errors';
import { FEATURES } from '../utils/featureFlags';

export default function ReportPage() {
  const { reportId } = useParams();
  const { signOut, user } = useAuthSession();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const dashboardPath = dashboardPathForRole(user?.role);
  const navTabs = tabsForRole(user?.role);
  const reportsTab = FEATURES.termReports && (user?.role === 'parent' || user?.role === 'teacher')
    ? 'reports'
    : 'overview';

  function goDashboardTab(id) {
    navigate(`${dashboardPath}${id === 'overview' ? '' : `?tab=${id}`}`);
  }

  useEffect(() => {
    if (!FEATURES.termReports) {
      navigate(dashboardPath, { replace: true });
      return undefined;
    }
    api.get(`/reports/${reportId}`)
      .then(({ data }) => setReport(data.report))
      .catch((requestError) => setError(parseApiError(requestError, 'This report could not be opened.')))
      .finally(() => setLoading(false));
    return undefined;
  }, [reportId, navigate, dashboardPath]);

  const summary = report?.summary || {};

  return (
    <DashboardShell
      onSignOut={signOut}
      variant={user?.role === 'learner' ? 'learner' : 'default'}
      tabs={navTabs}
      activeTab={reportsTab}
      onTabChange={goDashboardTab}
    >
      <button type="button" onClick={() => goDashboardTab(reportsTab)} className="ic-btn-ghost text-sm mb-4">
        ← Back to reports
      </button>

      {loading ? <EmptyState>Opening the report…</EmptyState> : null}
      <AlertBanner>{error}</AlertBanner>

      {report ? (
        <>
          <PageHeader
            kicker={report.periodLabel || 'Progress report'}
            title={report.title}
            subtitle={`${report.learnerName} · ${report.className || 'Class'} · ${formatDueDate(report.periodStart)} – ${formatDueDate(report.periodEnd)}`}
            doodle={false}
          />
          <p className="text-xs text-slate-500 -mt-3 mb-6">
            Published {formatDueDate(report.publishedAt)}. This snapshot will not change if later marks come in.
          </p>

          <StatGrid
            items={[
              {
                label: 'Quiz average',
                value: summary.quizzes?.average != null ? `${summary.quizzes.average}%` : '—',
                icon: IconQuizzes,
                tone: 'teal',
              },
              {
                label: 'Quizzes written',
                value: summary.quizzes?.attempts ?? 0,
                icon: IconQuizzes,
                tone: 'blue',
              },
              {
                label: 'Homework done',
                value: `${summary.homework?.completed ?? 0}/${summary.homework?.assigned ?? 0}`,
                icon: IconHomework,
                tone: 'purple',
              },
              {
                label: 'Still outstanding',
                value: summary.homework?.outstanding ?? 0,
                icon: IconReports,
                tone: 'orange',
              },
            ]}
          />

          {report.comment ? (
            <Panel title="A note from the teacher" icon={IconReports} tone="teal">
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{report.comment}</p>
            </Panel>
          ) : null}

          {(summary.subjects || []).length ? (
            <Panel title="By subject" icon={IconQuizzes} tone="purple">
              <div className="space-y-3">
                {summary.subjects.map((subject) => (
                  <RowCard key={subject.subjectId} icon={IconQuizzes} tone="purple">
                    <div className="ic-list-body">
                      <h3 className="ic-list-title">{subject.subjectName}</h3>
                      <p className="ic-list-meta">
                        Quizzes: {subject.quizAttempts} · average {subject.quizAverage ?? '—'}%
                        {subject.homeworkAssigned
                          ? ` · Homework ${subject.homeworkCompleted}/${subject.homeworkAssigned}${subject.homeworkAverage != null ? `, ${subject.homeworkAverage}%` : ''}`
                          : ''}
                      </p>
                    </div>
                  </RowCard>
                ))}
              </div>
            </Panel>
          ) : null}

          {summary.topics?.weaknesses?.length || summary.topics?.strengths?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel title="Going well" tone="mint">
                <ul className="space-y-2 text-sm text-slate-700">
                  {(summary.topics.strengths || []).map((item) => (
                    <li key={item.topic} className="ic-note-chip">{item.topic} · {item.accuracy}%</li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Please support at home" tone="orange">
                <ul className="space-y-2 text-sm text-slate-700">
                  {(summary.topics.weaknesses || []).map((item) => (
                    <li key={item.topic} className="ic-note-chip">{item.topic} · {item.accuracy}%</li>
                  ))}
                </ul>
              </Panel>
            </div>
          ) : null}
        </>
      ) : null}
    </DashboardShell>
  );
}
