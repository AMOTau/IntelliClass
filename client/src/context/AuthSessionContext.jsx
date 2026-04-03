import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { setAuthToken } from '../lib/api';
import { clearSession, loadStoredSession, storeSession } from '../auth/session';

const AuthSessionContext = createContext(null);

export function AuthSessionProvider({ children }) {
  const initialSession = loadStoredSession();
  const [token, setToken] = useState(initialSession.token);
  const [user, setUser] = useState(initialSession.user);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const value = useMemo(() => {
    function signIn(nextToken, nextUser) {
      setToken(nextToken);
      setUser(nextUser);
      storeSession(nextToken, nextUser);
    }

    function signOut() {
      setToken('');
      setUser(null);
      clearSession();
      setAuthToken('');
    }

    function updateUser(nextUser) {
      setUser(nextUser);
      if (token) {
        storeSession(token, nextUser);
      }
    }

    return {
      token,
      user,
      isAuthed: Boolean(token && user),
      signIn,
      signOut,
      updateUser,
    };
  }, [token, user]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSession must be used within AuthSessionProvider');
  }

  return context;
}
