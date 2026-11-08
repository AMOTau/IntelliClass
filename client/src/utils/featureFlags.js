/**
 * Presentation toggles — set to true when the feature is ready to show again.
 * Related code stays in the dashboards; these flags only hide UI entry points.
 */
export const FEATURES = {
  homework: false,
  termReports: false,
};

export function isFeatureEnabled(feature) {
  return Boolean(FEATURES[feature]);
}
