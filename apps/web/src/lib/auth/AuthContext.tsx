"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api-client";
import { loginRequest, logoutRequest, refreshRequest, signupRequest } from "./api";
import { setAccessToken } from "./token-store";
import type { LoginInput, SignupInput, TokenResponse, User } from "./types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (input: LoginInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Replaces the cached user (e.g. after a profile update) without touching the session. */
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function scheduleRefresh(expiresIn: number, callback: () => void): ReturnType<typeof setTimeout> {
  const delayMs = Math.max((expiresIn - 60) * 1000, 5000);
  return setTimeout(callback, delayMs);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applySessionRef = useRef<(session: TokenResponse) => void>(() => {});
  const bootRefreshStarted = useRef(false);

  const clearSession = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const applySession = useCallback(
    (session: TokenResponse) => {
      setAccessToken(session.access_token);
      setUser(session.user);
      setStatus("authenticated");

      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = scheduleRefresh(session.expires_in, () => {
        refreshRequest()
          .then((next) => applySessionRef.current(next))
          .catch(() => clearSession());
      });
    },
    [clearSession],
  );

  useEffect(() => {
    applySessionRef.current = applySession;
  }, [applySession]);

  useEffect(() => {
    // Guards against React Strict Mode's dev-only double-invoke of effects,
    // which would otherwise fire two concurrent /auth/refresh calls on boot.
    if (!bootRefreshStarted.current) {
      bootRefreshStarted.current = true;
      refreshRequest()
        .then(applySession)
        .catch(() => clearSession());
    }

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      const session = await loginRequest(input);
      applySession(session);
    },
    [applySession],
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      const session = await signupRequest(input);
      applySession(session);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    } finally {
      clearSession();
    }
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ user, status, login, signup, logout, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
