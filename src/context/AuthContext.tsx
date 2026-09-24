import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../lib/api";
import type { SessionData, User } from "../types";

interface AuthContextValue {
  session: SessionData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  setup: (input: Record<string, string>) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<SessionData | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<SessionData>("/api/auth/session");
      setSession(data);
      return data;
    } catch {
      setSession({ setupRequired: false, authenticated: false, user: null });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setSession({ setupRequired: false, authenticated: true, user: data.user });
    return data.user;
  }, []);

  const setup = useCallback(async (input: Record<string, string>) => {
    const data = await api<{ user: User }>("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setSession({ setupRequired: false, authenticated: true, user: data.user });
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api<void>("/api/auth/logout", { method: "POST" });
    setSession({ setupRequired: false, authenticated: false, user: null });
  }, []);

  const value = useMemo(
    () => ({ session, loading, login, setup, logout, refresh }),
    [session, loading, login, setup, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return context;
};
