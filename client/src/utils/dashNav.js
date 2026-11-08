import { FEATURES } from './featureFlags';

/** Shared side-nav tabs per role — keeps dashboards and secondary pages aligned. */

export const TEACHER_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'materials', label: 'Study materials' },
  { id: 'homework', label: 'Homework', feature: 'homework' },
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'messages', label: 'Write to parents' },
  { id: 'reports', label: 'Term reports', feature: 'termReports' },
];

export const LEARNER_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'homework', label: 'Homework', feature: 'homework' },
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'materials', label: 'Study materials' },
];

export const PARENT_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'homework', label: 'Homework', feature: 'homework' },
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'reports', label: 'Reports', feature: 'termReports' },
  { id: 'notes', label: 'Teacher notes' },
  { id: 'children', label: 'Your children' },
];

/** Admin school-office nav — grouped to match the administration dashboard. */
export const ADMIN_TABS = [
  { id: 'overview', label: 'Overview', section: 'Main' },
  { id: 'teachers', label: 'Teachers', section: 'People' },
  { id: 'learners', label: 'Learners', section: 'People' },
  { id: 'parents', label: 'Parents', section: 'People' },
  { id: 'classes', label: 'Classes', section: 'Academics' },
  { id: 'subjects', label: 'Subjects', section: 'Academics' },
  { id: 'records', label: 'User Accounts', section: 'Administration' },
];

function isTabVisible(tab) {
  if (!tab.feature) return true;
  return Boolean(FEATURES[tab.feature]);
}

export function visibleTabs(tabs) {
  return tabs.filter(isTabVisible);
}

/** Group flat tabs that share a `section` label for the side nav. */
export function groupTabsBySection(tabs) {
  const groups = [];
  const indexBySection = new Map();

  for (const tab of tabs) {
    const section = tab.section || '';
    if (!indexBySection.has(section)) {
      indexBySection.set(section, groups.length);
      groups.push({ section, tabs: [] });
    }
    groups[indexBySection.get(section)].tabs.push(tab);
  }

  return groups;
}

export function dashboardPathForRole(role) {
  if (role === 'teacher') return '/teacher-dashboard';
  if (role === 'admin') return '/admin';
  if (role === 'parent') return '/parent-dashboard';
  return '/learner-dashboard';
}

export function tabsForRole(role, { messageBadge } = {}) {
  if (role === 'teacher') return visibleTabs(TEACHER_TABS);
  if (role === 'admin') return visibleTabs(ADMIN_TABS);
  if (role === 'parent') {
    return visibleTabs(PARENT_TABS).map((tab) => (
      tab.id === 'notes' && messageBadge
        ? { ...tab, badge: messageBadge }
        : tab
    ));
  }
  return visibleTabs(LEARNER_TABS);
}

/** Resolve a ?tab= value to a visible tab id (falls back to overview). */
export function resolveActiveTab(requestedTab, tabs) {
  const list = tabs || [];
  if (requestedTab && list.some((tab) => tab.id === requestedTab)) {
    return requestedTab;
  }
  return 'overview';
}
