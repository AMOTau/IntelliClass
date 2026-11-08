import axios from 'axios';

const TOKEN_KEY = 'intliclass_token';
const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export const api = axios.create({
  baseURL,
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

// Restore the Bearer header immediately on app load so refresh does not race
// with dashboard fetches that run in child useEffects.
const storedToken = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
if (storedToken) {
  setAuthToken(storedToken);
}
