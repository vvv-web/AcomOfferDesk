import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthLink, LoginWebUserPayload } from '@shared/api/loginWebUser';
import { loginWebUser } from '@shared/api/loginWebUser';
import { setAuthToken, setUnauthorizedHandler } from '@shared/api/client';

type AuthSession = {
  token: string;
  roleId: number;
  login: string;
  availableActions: AuthLink[];
};

type AuthContextValue = {
  session: AuthSession | null;
  isAuthenticated: boolean;
  login: (payload: LoginWebUserPayload) => Promise<AuthSession>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const storageKey = 'order-web:session';

const parseSession = (raw: string | null): AuthSession | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token || typeof parsed.roleId !== 'number' || !parsed.login) {
      return null;
    }
    return {
      ...parsed,
      availableActions: Array.isArray(parsed.availableActions) ? parsed.availableActions : []
    };
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [session, setSession] = useState<AuthSession | null>(() => parseSession(localStorage.getItem(storageKey)));

  const persistSession = useCallback((nextSession: AuthSession | null) => {
    if (nextSession) {
      localStorage.setItem(storageKey, JSON.stringify(nextSession));
      setAuthToken(nextSession.token);
    } else {
      localStorage.removeItem(storageKey);
      setAuthToken(null);
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    persistSession(null);
    navigate('/login', { replace: true });
  }, [navigate, persistSession]);

  const login = useCallback(
    async (payload: LoginWebUserPayload) => {
      const response = await loginWebUser(payload);
      const nextSession: AuthSession = {
        token: response.data.access_token,
        roleId: response.data.role_id,
        login: payload.login,
        availableActions: response._links?.available_actions ?? response._links?.availableActions ?? []
      };
      setSession(nextSession);
      persistSession(nextSession);
      return nextSession;
    },
    [persistSession]
  );

  useEffect(() => {
    if (session?.token) {
      setAuthToken(session.token);
    }
  }, [session?.token]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session?.token),
      login,
      logout
    }),
    [login, logout, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
