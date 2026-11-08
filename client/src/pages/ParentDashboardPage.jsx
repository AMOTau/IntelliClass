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
  IconChildren,
  IconHomework,
  IconMessages,
  IconQuizzes,
  IconReports,
} from '../components/ui/DashIcons';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { resolveActiveTab, tabsForRole } from '../utils/dashNav';
import { formatDueDate } from '../utils/dates';
import { parseApiError } from '../utils/errors';
import { FEATURES } from '../utils/featureFlags';

function homeworkStatus(item) {
  if (item.score !== null && item.score !== undefined) {
    return { label: `Marked ${item.score}/${item.maxScore}`, tone: 'mint' };
  }
  if (item.completed) {
    return { label: 'Handed in', tone: 'ok' };
  }
  if (item.overdue) {
    return { label: 'Overdue', tone: 'danger' };
  }
  if (item.dueSoon) {
    return { label: 'Due soon', tone: 'warn' };
  }
  return { label: 'Not done yet', tone: 'blue' };
}

export default function ParentDashboardPage() {
  const { user, signOut } = useAuthSession();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyingId, setReplyingId] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [replySaving, setReplySaving] = useState(false);
  const [replyNotice, setReplyNotice] = useState('');
  const [dashData, setDashData] = useState({
    children: [],
    childrenClasses: [],
    recentQuizResults: [],
    homeworkNotifications: [],
    childQuizzes: [],
    childHomework: [],
    childReports: [],
    childInsights: [],
    parentMessages: [],
    unreadCount: 0,
  });

  const messageCount = (dashData.parentMessages ?? []).length;
  const parentTabs = tabsForRole('parent', { messageBadge: messageCount });
  const initialTab = resolveActiveTab(searchParams.get('tab'), parentTabs);
  const [activeTab, setActiveTab] = useState(initialTab);

  function selectTab(id) {
    setActiveTab(id);
    setSearchParams(id === 'overview' ? {} : { tab: id }, { replace: true });
  }

  useEffect(() => {
    loadParentData();
  }, []);

  async function loadParentData() {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/dashboard/parent');
      setDashData(data);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to load dashboard data.'));
    } finally {
      setLoading(false);
    }
  }

  async function markNotificationsSeen() {
    try {
      await api.post('/dashboard/parent/notifications/seen');
      setDashData((current) => ({
        ...current,
        unreadCount: 0,
        homeworkNotifications: (current.homeworkNotifications ?? []).map((item) => ({ ...item, unread: false })),
      }));
    } catch {
      // Seeing the bell still works if this request fails.
    }
  }

  function startReply(note) {
    setError('');
    setReplyNotice('');
    setReplyingId(note.id);
    setReplyDraft(note.parentReply || '');
  }

  function cancelReply() {
    setReplyingId('');
    setReplyDraft('');
  }

  async function submitReply(event) {
    event.preventDefault();
    if (!replyingId) return;
    setReplySaving(true);
    setError('');
    setReplyNotice('');
    try {
      const { data } = await api.post(`/messages/${replyingId}/reply`, { body: replyDraft });
      setDashData((current) => ({
        ...current,
        parentMessages: (current.parentMessages ?? []).map((note) => (
          note.id === replyingId
            ? {
                ...note,
                parentReply: data.reply?.parentReply ?? replyDraft,
                parentRepliedAt: data.reply?.parentRepliedAt ?? new Date().toISOString(),
              }
            : note
        )),
      }));
      setReplyNotice(data.message || 'Reply sent.');
      setReplyingId('');
      setReplyDraft('');
    } catch (requestError) {
      setError(parseApiError(requestError, 'Could not send that reply.'));
    } finally {
      setReplySaving(false);
    }
  }

  const calculateAverageScore = (childId) => {
    const childResults = dashData.recentQuizResults.filter(
      (result) => result.learner_id === childId
    );
    if (childResults.length === 0) return 0;
    const total = childResults.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
    return Math.round(total / childResults.length);
  };

  const outstandingHomework = (dashData.childHomework ?? []).filter((item) => !item.completed);
  const insightFor = (childId) => (dashData.childInsights ?? []).find((item) => item.learnerId === childId);
  const visibleNotifications = (dashData.homeworkNotifications ?? []).filter((item) => {
    const homeworkTypes = new Set(['assigned', 'due_soon', 'overdue', 'completed', 'graded']);
    if (!FEATURES.homework && homeworkTypes.has(item.type)) return false;
    if (!FEATURES.termReports && item.type === 'report') return false;
    return true;
  });

  const titles = {
    overview: `Welcome, ${user?.firstName}!`,
    homework: 'Homework',
    quizzes: 'Quizzes',
    reports: 'Reports',
    notes: 'Notes from the teacher',
    children: 'Your children',
  };
  const subtitles = {
    overview: FEATURES.termReports
      ? "Here's a quiet overview of how your child is getting on — without waiting for the end-of-term envelope."
      : "Here's a quiet overview of how your child is getting on with quizzes and class notes.",
    homework: 'What is due, what has been handed in, and the mark once the teacher has looked at it.',
    quizzes: 'You can view a quiz, including ones already finished. Parents cannot take the quiz.',
    reports: 'When a term closes, the teacher publishes a snapshot here.',
    notes: 'These also arrive as alerts. You can reply here on IntelliClass.',
    children: 'A quick picture of each child, enrolment, and recent quiz results.',
  };

  return (
    <DashboardShell
      onSignOut={signOut}
      notifications={visibleNotifications}
      onOpenNotifications={markNotificationsSeen}
      tabs={parentTabs}
      activeTab={activeTab}
      onTabChange={selectTab}
    >
      <PageHeader
        kicker={activeTab === 'overview' ? 'Parent dashboard' : 'Parent desk'}
        title={titles[activeTab]}
        subtitle={subtitles[activeTab]}
        doodle={activeTab === 'overview'}
      />
      <AlertBanner>{error}</AlertBanner>

      {loading ? (
        <EmptyState>Opening the parent desk…</EmptyState>
      ) : (
        <>
          {activeTab === 'overview' ? (
            <>
              <StatGrid
                items={[
                  {
                    label: 'Children',
                    value: dashData.children.length,
                    hint: 'Linked to your account',
                    icon: IconChildren,
                    tone: 'teal',
                    onClick: () => selectTab('children'),
                  },
                  FEATURES.homework
                    ? {
                        label: 'Homework open',
                        value: outstandingHomework.length,
                        hint: 'Still to be handed in',
                        icon: IconHomework,
                        tone: 'blue',
                        onClick: () => selectTab('homework'),
                      }
                    : {
                        label: 'Quizzes',
                        value: (dashData.childQuizzes ?? []).length,
                        hint: 'Available to view together',
                        icon: IconQuizzes,
                        tone: 'blue',
                        onClick: () => selectTab('quizzes'),
                      },
                  {
                    label: 'Quiz results',
                    value: dashData.recentQuizResults.length,
                    hint: 'Recent scores to review together',
                    icon: IconQuizzes,
                    tone: 'purple',
                    onClick: () => selectTab('quizzes'),
                  },
                  FEATURES.termReports
                    ? {
                        label: 'Reports ready',
                        value: (dashData.childReports ?? []).length,
                        hint: 'Published progress snapshots',
                        icon: IconReports,
                        tone: 'orange',
                        onClick: () => selectTab('reports'),
                      }
                    : {
                        label: 'Teacher notes',
                        value: messageCount,
                        hint: 'Messages from the teacher',
                        icon: IconMessages,
                        tone: 'orange',
                        onClick: () => selectTab('notes'),
                      },
                ]}
              />
              <QuickStart
                items={[
                  FEATURES.homework
                    ? { id: 'homework', label: 'Homework', hint: `${outstandingHomework.length} still open`, icon: IconHomework, tone: 'teal', onClick: () => selectTab('homework') }
                    : null,
                  { id: 'quizzes', label: 'Quizzes', hint: 'View or review together', icon: IconQuizzes, tone: 'blue', onClick: () => selectTab('quizzes') },
                  FEATURES.termReports
                    ? { id: 'reports', label: 'Reports', hint: `${(dashData.childReports ?? []).length} ready to read`, icon: IconReports, tone: 'purple', onClick: () => selectTab('reports') }
                    : null,
                  { id: 'notes', label: 'Teacher notes', hint: messageCount ? `${messageCount} note(s)` : 'No notes yet', icon: IconMessages, tone: 'orange', onClick: () => selectTab('notes') },
                  { id: 'children', label: 'Your children', hint: 'Averages and enrolment', icon: IconChildren, tone: 'mint', onClick: () => selectTab('children') },
                ].filter(Boolean)}
              />
            </>
          ) : null}

          {FEATURES.homework && activeTab === 'homework' ? (
            <Panel
              title="Homework"
              subtitle="Follow what is due, what has been handed in, and the mark once the teacher has looked at it."
              icon={IconHomework}
              tone="blue"
            >
              {(dashData.childHomework ?? []).length === 0 ? (
                <EmptyState>No homework for your children yet.</EmptyState>
              ) : (
                <div className="space-y-3">
                  {dashData.childHomework.map((item) => {
                    const status = homeworkStatus(item);
                    return (
                      <RowCard key={item.id} icon={IconHomework} tone="blue">
                        <div className="ic-list-body">
                          <h3 className="ic-list-title">{item.title}</h3>
                          <p className="ic-list-meta">
                            {item.childName} · {item.subject || 'Subject'} · {item.className || 'Class'} · Due {formatDueDate(item.dueDate)}
                          </p>
                          {item.description ? <p className="text-sm text-slate-600 mt-2">{item.description}</p> : null}
                          {item.feedback ? (
                            <p className="text-sm text-slate-700 mt-3 rounded-lg bg-[#e7f4ef] border border-teal-100 px-3 py-2">
                              Teacher’s note: {item.feedback}
                            </p>
                          ) : null}
                        </div>
                        <div className="ic-list-actions">
                          <StatusPill tone={status.tone}>{status.label}</StatusPill>
                        </div>
                      </RowCard>
                    );
                  })}
                </div>
              )}
            </Panel>
          ) : null}

          {FEATURES.termReports && activeTab === 'reports' ? (
            <Panel
              title="Reports"
              subtitle="When a term closes, the teacher publishes a snapshot here for you to read."
              icon={IconReports}
              tone="orange"
            >
              {(dashData.childReports ?? []).length === 0 ? (
                <EmptyState>No reports have been published yet.</EmptyState>
              ) : (
                <div className="space-y-3">
                  {dashData.childReports.map((report) => (
                    <RowCard key={report.id} icon={IconReports} tone="orange">
                      <div className="ic-list-body">
                        <h3 className="ic-list-title">{report.title}</h3>
                        <p className="ic-list-meta">
                          {report.childName} · {report.periodLabel || 'Progress'} · {formatDueDate(report.periodStart)} – {formatDueDate(report.periodEnd)}
                        </p>
                      </div>
                      <div className="ic-list-actions">
                        <button type="button" onClick={() => navigate(`/reports/${report.id}`)} className="ic-btn-primary text-sm">
                          Read report
                        </button>
                      </div>
                    </RowCard>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}

          {activeTab === 'notes' ? (
            <Panel
              title="Notes from the teacher"
              subtitle="These also arrive as alerts. Reply here and the teacher will see it on IntelliClass."
              icon={IconMessages}
              tone="orange"
            >
              <AlertBanner tone="ok">{replyNotice}</AlertBanner>
              {(dashData.parentMessages ?? []).length === 0 ? (
                <EmptyState>No notes from teachers yet.</EmptyState>
              ) : (
                <div className="space-y-3">
                  {dashData.parentMessages.map((note) => (
                    <RowCard key={note.id} icon={IconMessages} tone="orange" className="!items-stretch">
                      <div className="ic-list-body w-full">
                        <p className="ic-kicker">{note.teacherName} · {note.childName}</p>
                        <h3 className="ic-list-title mt-1">{note.title}</h3>
                        <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap leading-relaxed">{note.body}</p>

                        {note.parentReply ? (
                          <div className="ic-note-chip mt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Your reply</p>
                            <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed">{note.parentReply}</p>
                            {note.parentRepliedAt ? (
                              <p className="text-xs text-slate-500 mt-2">
                                Sent {new Date(note.parentRepliedAt).toLocaleString()}
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        {replyingId === note.id ? (
                          <form className="fk-card !shadow-none mt-4" onSubmit={submitReply}>
                            <div className="fk-step-head !mb-3">
                              <span className="fk-step-badge" aria-hidden="true">1</span>
                              <h4 className="fk-step-title">Your reply</h4>
                            </div>
                            <label className="fk-field">
                              <span className="fk-label">Message<span className="fk-req">*</span></span>
                              <span className="fk-control">
                                <textarea
                                  value={replyDraft}
                                  onChange={(event) => setReplyDraft(event.target.value)}
                                  placeholder={`Write a reply to ${note.teacherName}…`}
                                  required
                                  maxLength={4000}
                                  rows={4}
                                />
                              </span>
                            </label>
                            <div className="fk-actions !mt-4 !pt-4">
                              <button type="button" onClick={cancelReply} className="fk-btn fk-btn--ghost">
                                × Cancel
                              </button>
                              <button type="submit" disabled={replySaving} className="fk-btn fk-btn--primary">
                                {replySaving ? 'Sending…' : note.parentReply ? 'Update reply' : 'Send reply'}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button type="button" onClick={() => startReply(note)} className="ic-btn-primary text-sm">
                              {note.parentReply ? 'Edit reply' : 'Respond'}
                            </button>
                            <p className="text-xs text-slate-500">
                              Or contact {note.teacherName}
                              {note.teacherPhone ? ` on ${note.teacherPhone}` : ''}
                              {note.teacherEmail ? ` / ${note.teacherEmail}` : ''}.
                            </p>
                          </div>
                        )}
                      </div>
                    </RowCard>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}

          {activeTab === 'quizzes' ? (
            <>
              <Panel
                title="Quizzes"
                subtitle="Open a finished quiz to review the score, skills, and missed questions together. Parents cannot submit answers."
                icon={IconQuizzes}
                tone="purple"
              >
                {(dashData.childQuizzes ?? []).length === 0 ? (
                  <EmptyState>No quizzes for your children yet.</EmptyState>
                ) : (
                  <div className="space-y-3">
                    {dashData.childQuizzes.map((quiz) => {
                      const completed = Boolean(quiz.submission_id);
                      const score = Number(quiz.score);
                      return (
                        <RowCard key={`${quiz.quiz_id}-${quiz.learner_id}`} icon={IconQuizzes} tone="purple">
                          <div className="ic-list-body">
                            <h3 className="ic-list-title">{quiz.title}</h3>
                            <p className="ic-list-meta">
                              {quiz.first_name} {quiz.last_name} · {quiz.subject_name || 'Subject'} · {quiz.class_name || 'Class'} · Due {formatDueDate(quiz.due_date || quiz.dueDate)}
                            </p>
                          </div>
                          <div className="ic-list-actions">
                            <StatusPill tone={completed ? (score >= 70 ? 'ok' : score >= 50 ? 'warn' : 'danger') : 'warn'}>
                              {completed ? `${Number.isFinite(score) ? score : 0}%` : 'Not done'}
                            </StatusPill>
                            <button
                              type="button"
                              onClick={() => navigate(`/quizzes/${quiz.quiz_id}?learnerId=${quiz.learner_id}`)}
                              className="ic-btn-soft"
                            >
                              {completed ? 'Review together' : 'View'}
                            </button>
                          </div>
                        </RowCard>
                      );
                    })}
                  </div>
                )}
              </Panel>

              <Panel title="Recent quiz performance" icon={IconQuizzes} tone="mint">
                {dashData.recentQuizResults.length === 0 ? (
                  <EmptyState>No quiz results yet.</EmptyState>
                ) : (
                  <div className="space-y-3">
                    {dashData.recentQuizResults.map((result) => {
                      const score = Number(result.score) || 0;
                      const tone = score >= 70 ? 'ok' : score >= 50 ? 'warn' : 'danger';
                      return (
                        <RowCard key={result.id} icon={IconQuizzes} tone="mint">
                          <div className="ic-list-body">
                            <h3 className="ic-list-title">
                              {result.first_name} {result.last_name}
                            </h3>
                            <p className="text-slate-700 font-semibold mt-1">{result.title}</p>
                            <p className="ic-list-meta">
                              Completed {new Date(result.created_at).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-slate-600 mt-2">
                              {score >= 70
                                ? 'A result to be proud of'
                                : score >= 50
                                  ? 'Room to grow — sit with them'
                                  : 'They found this hard. Please be kind, and ask the teacher if you need a plan.'}
                            </p>
                          </div>
                          <div className="ic-list-actions">
                            <StatusPill tone={tone}>{score}%</StatusPill>
                            <button
                              type="button"
                              onClick={() => navigate(`/quizzes/${result.quiz_id}?learnerId=${result.learner_id}`)}
                              className="ic-btn-soft"
                            >
                              Review together
                            </button>
                          </div>
                        </RowCard>
                      );
                    })}
                  </div>
                )}
              </Panel>
            </>
          ) : null}

          {activeTab === 'children' ? (
            <>
              <Panel
                title="Your children"
                subtitle={FEATURES.homework
                  ? 'Averages, homework progress, and a topic to sit with them on when we have enough answers.'
                  : 'Quiz averages and a topic to sit with them on when we have enough answers.'}
                icon={IconChildren}
                tone="teal"
              >
                {dashData.children.length === 0 ? (
                  <EmptyState>No children linked to your account yet.</EmptyState>
                ) : (
                  <div className="space-y-3">
                    {dashData.children.map((child) => {
                      const insight = insightFor(child.id);
                      const weak = insight?.topics?.weaknesses?.[0];
                      return (
                        <RowCard key={child.id} icon={IconChildren} tone="teal">
                          <div className="ic-list-body">
                            <h3 className="ic-list-title">
                              {child.first_name} {child.last_name}
                            </h3>
                            <p className="ic-list-meta">
                              Quiz average {calculateAverageScore(child.id)}%
                              {FEATURES.homework
                                ? ` · Homework ${insight?.homework?.completed ?? 0} done, ${insight?.homework?.outstanding ?? 0} still open`
                                : ''}
                            </p>
                            {weak ? (
                              <p className="text-sm text-amber-800 mt-2">A topic to sit with them on: {weak.topic}.</p>
                            ) : (
                              <p className="text-sm text-slate-500 mt-2">Not enough quiz answers yet to name a weak topic.</p>
                            )}
                          </div>
                        </RowCard>
                      );
                    })}
                  </div>
                )}
              </Panel>

              <Panel title="Class enrolment" icon={IconChildren} tone="mint">
                {dashData.childrenClasses.length === 0 ? (
                  <EmptyState>No class enrolment information available yet.</EmptyState>
                ) : (
                  <div className="space-y-3">
                    {dashData.childrenClasses.map((enrollment) => (
                      <RowCard key={`${enrollment.learner_id}-${enrollment.id}`} icon={IconChildren} tone="mint">
                        <div className="ic-list-body">
                          <h3 className="ic-list-title">{enrollment.name}</h3>
                          <p className="ic-list-meta">
                            {enrollment.first_name} {enrollment.last_name}
                          </p>
                        </div>
                        <div className="ic-list-actions">
                          <StatusPill tone="ok">Enrolled</StatusPill>
                        </div>
                      </RowCard>
                    ))}
                  </div>
                )}
              </Panel>
            </>
          ) : null}
        </>
      )}
    </DashboardShell>
  );
}
