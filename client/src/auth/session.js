const TOKEN_KEY = 'intliclass_token';
const USER_KEY = 'intliclass_user';

export function loadStoredSession() {
  const token = localStorage.getItem(TOKEN_KEY) ?? '';
  const rawUser = localStorage.getItem(USER_KEY);

  let user = null;
  if (rawUser) {
    try {
      user = JSON.parse(rawUser);
    } catch {
      user = null;
    }
  }

  return { token, user };
}

export function storeSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
