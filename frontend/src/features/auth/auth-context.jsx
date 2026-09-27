import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'pixsolve.auth';
const AuthContext = createContext(null);

const readSession = () => {
  try {
    const session = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (session?.accessToken && Number.isFinite(session.expiresAt) && session.expiresAt > Date.now()) return session;
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(readSession);
  const [authExpired, setAuthExpired] = useState(false);

  const clearSession = useCallback(({ expired = false } = {}) => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setAuthExpired(expired);
  }, []);

  const establishSession = useCallback(({ accessToken, expiresIn }) => {
    const nextSession = { accessToken, expiresAt: Date.now() + (expiresIn * 1000) };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
    setAuthExpired(false);
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    const delay = Math.max(0, session.expiresAt - Date.now());
    const timeout = window.setTimeout(() => clearSession({ expired: true }), delay);
    return () => window.clearTimeout(timeout);
  }, [session, clearSession]);

  const value = useMemo(() => ({
    session,
    isAuthenticated: Boolean(session),
    authExpired,
    establishSession,
    clearSession
  }), [session, authExpired, establishSession, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
};
