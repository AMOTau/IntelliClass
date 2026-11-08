import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardShell, {
  AlertBanner,
  EmptyState,
  PageHeader,
  Panel,
  QuickStart,
  RowCard,
  StatGrid,
  StatusPill,
} from '../components/ui/DashboardShell';
import {
  IconClasses,
  IconHomework,
  IconMaterials,
  IconQuizzes,
} from '../components/ui/DashIcons';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { resolveActiveTab, tabsForRole } from '../utils/dashNav';
import { formatDueDate } from '../utils/dates';
import { parseApiError } from '../utils/errors';
import { FEATURES } from '../utils/featureFlags';

const fileOrigin = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/api\/?$/, '');

function isHomeworkDone(homework) {
  return homework.submission_status === 'submitted' || homework.submission_status === 'late';
}

export default function LearnerDashboardPage() {
  const { user, signOut } = useAuthSession();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const learnerTabs = tabsForRole('learner');
  const initialTab = resolveActiveTab(searchParams.get('tab'), learnerTabs);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [dashData, setDashData] = useState({
    classes: [],
    assignedHomework: [],
    availableQuizzes: [],
    studyMaterials: [],
    submissionStats: {
      totalSubmissions: 0,
      completed: 0,
    },
  });

  function selectTab(id) {
    setActiveTab(id);
    setSearchParams(id === 'overview' ? {} : { tab: id }, { replace: true });
  }

  useEffect(() => {
    loadLearnerData();
  }, []);

  async function markHomeworkComplete(homeworkId) {
    setError('');
    try {
      await api.post(`/homework/${homeworkId}/complete`);
      await loadLearnerData();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to mark homework complete.'));
    }
  }

  async function loadLearnerData() {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/dashboard/learner');
      setDashData({
        ...data,
        studyMaterials: data.studyMaterials ?? [],
      });
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to load dashboard data.'));
    } finally {
      setLoading(false);
    }
  }

  const completedHomework = dashData.assignedHomework.filter(isHomeworkDone);
  const openHomework = dashData.assignedHomework.filter((hw) => !isHomeworkDone(hw));
  const pendingHomework = openHomework.filter((hw) => {
    const match = String(hw.due_date || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      return true;
    }
    const due = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due >= today;
  });
  const overdueHomework = openHomework.filter((hw) => !pendingHomework.includes(hw) && hw.due_date);

  const titles = {
    overview: `Welcome, ${user?.firstName}!`,
    homework: 'Homework',
    quizzes: 'Quizzes',
    materials: 'Study materials',
  };
  const subtitles = {
    overview: FEATURES.homework
      ? "Here's a quick look at your homework, quizzes, and notes for today."
      : "Here's a quick look at your quizzes and study notes for today.",
    homework: 'What is due, what you have handed in, and your mark when it is ready.',
    quizzes: 'Take a quiz or open a result you have already written.',
    materials: 'PDFs your teacher has shared with the class.',
  };

  const finishedQuizzes = dashData.availableQuizzes.filter((quiz) => quiz.score != null).length;
  const openQuizzes = dashData.availableQuizzes.length - finishedQuizzes;

  return (
    <DashboardShell
      variant="learner"
      onSignOut={signOut}
      tabs={learnerTabs}
      activeTab={activeTab}
      onTabChange={selectTab}
    >
      <PageHeader
        kicker={activeTab === 'overview' ? 'Learner dashboard' : 'Learner desk'}
        title={titles[activeTab]}
        subtitle={subtitles[activeTab]}
        doodle={activeTab === 'overview'}
      />
      <AlertBanner>{error}</AlertBanner>

      {loading ? (
        <EmptyState>Opening your desk…</EmptyState>
      ) : (
        <>
          {activeTab === 'overview' ? (
            <>
              <StatGrid
                items={FEATURES.homework
                  ? [
                      {
                        label: 'Classes',
                        value: dashData.classes.length,
                        hint: 'Your enrolled classes',
                        icon: IconClasses,
                        tone: 'teal',
                        onClick: () => selectTab('materials'),
                      },
                      {
                        label: 'Pending',
                        value: pendingHomework.length,
                        hint: 'Homework still to hand in',
                        icon: IconHomework,
                        tone: 'blue',
                        onClick: () => selectTab('homework'),
                      },
                      {
                        label: 'Overdue',
                        value: overdueHomework.length,
                        hint: 'Past the due date — catch up kindly',
                        icon: IconHomework,
                        tone: 'orange',
                        onClick: () => selectTab('homework'),
                      },
                      {
                        label: 'Completed',
                        value: completedHomework.length,
                        hint: 'Work you have already handed in',
                        icon: IconQuizzes,
                        tone: 'purple',
                        onClick: () => selectTab('homework'),
                      },
                    ]
                  : [
                      {
                        label: 'Classes',
                        value: dashData.classes.length,
                        hint: 'Your enrolled classes',
                        icon: IconClasses,
                        tone: 'teal',
                        onClick: () => selectTab('materials'),
                      },
                      {
                        label: 'Quizzes open',
                        value: openQuizzes,
                        hint: 'Still to take',
                        icon: IconQuizzes,
                        tone: 'blue',
                        onClick: () => selectTab('quizzes'),
                      },
                      {
                        label: 'Finished',
                        value: finishedQuizzes,
                        hint: 'Quizzes you have already written',
                        icon: IconQuizzes,
                        tone: 'purple',
                        onClick: () => selectTab('quizzes'),
                      },
                      {
                        label: 'Study notes',
                        value: dashData.studyMaterials.length,
                        hint: 'PDFs shared with your class',
                        icon: IconMaterials,
                        tone: 'orange',
                        onClick: () => selectTab('materials'),
                      },
                    ]}
              />
              <QuickStart
                items={[
                  FEATURES.homework
                    ? { id: 'homework', label: 'Homework', hint: `${pendingHomework.length} pending · open your list`, icon: IconHomework, tone: 'teal', onClick: () => selectTab('homework') }
                    : null,
                  { id: 'quizzes', label: 'Quizzes', hint: `${dashData.availableQuizzes.length} available to take or review`, icon: IconQuizzes, tone: 'blue', onClick: () => selectTab('quizzes') },
                  { id: 'materials', label: 'Study Materials', hint: `${dashData.studyMaterials.length} PDFs shared with your class`, icon: IconMaterials, tone: 'purple', onClick: () => selectTab('materials') },
                ].filter(Boolean)}
              />
            </>
          ) : null}

          {FEATURES.homework && activeTab === 'homework' ? (
            <Panel
              title="Homework"
              subtitle="Mark work complete when you finish. Your mark appears here once the teacher has looked at it."
              icon={IconHomework}
              tone="blue"
            >
              {dashData.assignedHomework.length === 0 ? (
                <EmptyState>No homework yet. Enjoy the quiet while it lasts.</EmptyState>
              ) : (
                <div className="space-y-3">
                  {dashData.assignedHomework.map((homework) => {
                    const done = isHomeworkDone(homework);
                    const overdue = overdueHomework.some((item) => item.id === homework.id);
                    return (
                      <RowCard key={homework.id} icon={IconHomework} tone={overdue && !done ? 'orange' : 'blue'}>
                        <div className="ic-list-body">
                          <h3 className="ic-list-title">{homework.title}</h3>
                          <p className="ic-list-meta">
                            {homework.subject || 'Subject'} · {homework.class_name || 'Class'} · Due {formatDueDate(homework.due_date)}
                          </p>
                          {homework.description ? <p className="text-sm text-slate-600 mt-2">{homework.description}</p> : null}
                          {homework.score != null ? (
                            <p className="text-sm text-teal-800 mt-2 font-semibold">
                              Mark: {homework.score}/{homework.max_score ?? 10}
                              {homework.feedback ? ` · ${homework.feedback}` : ''}
                            </p>
                          ) : null}
                        </div>
                        <div className="ic-list-actions">
                          {done ? (
                            <StatusPill tone={homework.score != null ? 'mint' : 'ok'}>
                              {homework.score != null ? 'Marked' : 'Handed in'}
                            </StatusPill>
                          ) : (
                            <>
                              {overdue ? <StatusPill tone="danger">Overdue</StatusPill> : null}
                              <button type="button" onClick={() => markHomeworkComplete(homework.id)} className="ic-btn-primary text-sm">
                                Mark complete
                              </button>
                            </>
                          )}
                        </div>
                      </RowCard>
                    );
                  })}
                </div>
              )}
            </Panel>
          ) : null}

          {activeTab === 'quizzes' ? (
            <Panel
              title="Quizzes"
              subtitle="Open a quiz to write it, or reopen one you have already finished to see your score."
              icon={IconQuizzes}
              tone="purple"
            >
              {dashData.availableQuizzes.length === 0 ? (
                <EmptyState>No quizzes yet.</EmptyState>
              ) : (
                <div className="space-y-3">
                  {dashData.availableQuizzes.map((quiz) => (
                    <RowCard
                      key={quiz.id}
                      as="button"
                      type="button"
                      onClick={() => navigate(`/quizzes/${quiz.id}`)}
                      icon={IconQuizzes}
                      tone="purple"
                    >
                      <div className="ic-list-body">
                        <h3 className="ic-list-title">{quiz.title}</h3>
                        <p className="ic-list-meta">
                          {quiz.subject_name || 'Subject'} · {quiz.class_name || 'Class'} · Due {formatDueDate(quiz.due_date || quiz.dueDate)}
                        </p>
                      </div>
                      <div className="ic-list-actions">
                        {quiz.score != null ? (
                          <StatusPill tone="mint">{quiz.score}%</StatusPill>
                        ) : (
                          <span className="ic-btn-soft">Take quiz</span>
                        )}
                      </div>
                    </RowCard>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}

          {activeTab === 'materials' ? (
            <Panel
              title="Study materials"
              subtitle="PDFs shared with your class — open them in a new tab to revise."
              icon={IconMaterials}
              tone="teal"
            >
              {dashData.studyMaterials.length === 0 ? (
                <EmptyState>No study materials have been shared with your class yet.</EmptyState>
              ) : (
                <div className="space-y-3">
                  {dashData.studyMaterials.map((material) => (
                    <RowCard
                      key={material.id}
                      as="a"
                      href={`${fileOrigin}${material.fileUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      icon={IconMaterials}
                      tone="teal"
                    >
                      <div className="ic-list-body">
                        <h3 className="ic-list-title">{material.title}</h3>
                        <p className="ic-list-meta">{material.subject} · {material.class_name}</p>
                      </div>
                      <div className="ic-list-actions">
                        <span className="ic-btn-soft">Open PDF</span>
                      </div>
                    </RowCard>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}
        </>
      )}
    </DashboardShell>
  );
}
