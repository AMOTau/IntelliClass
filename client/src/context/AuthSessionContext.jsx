import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

  const signIn = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    storeSession(nextToken, nextUser);
  }, []);

  const signOut = useCallback(() => {
    setToken('');
    setUser(null);
    clearSession();
    setAuthToken('');
  }, []);

  const updateUser = useCallback((nextUser) => {
    setUser(nextUser);
    // Access token from closure or use setState callback pattern
    setToken((currentToken) => {
      if (currentToken) {
        storeSession(currentToken, nextUser);
      }
      return currentToken;
    });
  }, []);

  const value = useMemo(() => ({
    token,
    user,
    isAuthed: Boolean(token && user),
    signIn,
    signOut,
    updateUser,
  }), [token, user, signIn, signOut, updateUser]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSession must be used within AuthSessionProvider');
  }

  return context;
}
