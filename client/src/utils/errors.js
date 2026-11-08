export function parseApiError(error, fallback) {
  const payload = error?.response?.data;
  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message;
  }
  if (typeof payload?.error === 'string' && payload.error.trim()) {
    return payload.error;
  }
  if (typeof payload?.warning === 'string' && payload.warning.trim()) {
    return payload.warning;
  }
  if (error?.message === 'Network Error') {
    return 'Could not reach the server. Check that the API is running.';
  }
  return fallback;
}
