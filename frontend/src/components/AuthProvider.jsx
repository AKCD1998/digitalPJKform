import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { login as loginRequest, me as meRequest } from "../api/auth.js";
import { setAccessToken } from "../api/client.js";

const STORAGE_KEY = "digitalPjkform.auth";

const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.token !== "string") {
      return null;
    }

    return parsed;
  } catch (_error) {
    return null;
  }
}

function writeStoredSession(session) {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [branch, setBranch] = useState(null);
  const [documentDate, setDocumentDate] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const applySession = useCallback((session) => {
    setToken(session?.token || null);
    setUser(session?.user || null);
    setBranch(session?.branch || null);
    setDocumentDate(session?.documentDate || null);
    setAccessToken(session?.token || null);
    writeStoredSession(session || null);
  }, []);

  const clearSession = useCallback(() => {
    applySession(null);
  }, [applySession]);

  const loginWithCredentials = useCallback(async (username, password) => {
    const result = await loginRequest({ username, password });
    const nextSession = {
      token: result.token,
      user: result.user,
      branch: result.branch,
      documentDate: result.documentDate || null,
    };
    applySession(nextSession);
    return nextSession;
  }, [applySession]);

  const updateDocumentDate = useCallback((nextDocumentDate) => {
    if (!token || !user) {
      return;
    }

    applySession({
      token,
      user,
      branch,
      documentDate: nextDocumentDate || null,
    });
  }, [applySession, token, user, branch]);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      const stored = readStoredSession();
      if (!stored?.token) {
        if (active) {
          setIsBootstrapping(false);
        }
        return;
      }

      setAccessToken(stored.token);

      try {
        const profile = await meRequest();
        if (!active) {
          return;
        }

        applySession({
          token: stored.token,
          user: profile.user,
          branch: profile.branch,
          documentDate: profile.documentDate || null,
        });
      } catch (_error) {
        if (active) {
          clearSession();
        }
      } finally {
        if (active) {
          setIsBootstrapping(false);
        }
      }
    };

    restoreSession();

    return () => {
      active = false;
    };
  }, [applySession, clearSession]);

  const value = useMemo(
    () => ({
      token,
      user,
      branch,
      documentDate,
      isBootstrapping,
      isAuthenticated: Boolean(token && user && (user.role === "admin" || branch)),
      loginWithCredentials,
      updateDocumentDate,
      clearSession,
    }),
    [token, user, branch, documentDate, isBootstrapping]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
