export function parseApiError(error, fallback) {
  return error?.response?.data?.message ?? fallback;
}
