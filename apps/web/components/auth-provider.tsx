"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type { UserProfile } from "@/lib/types";

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  sessionError: string | null;
  refreshSession: () => Promise<void>;
  authenticate: (profile: UserProfile) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not check your session.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const refreshSession = useCallback(async () => {
    const version = ++requestVersion.current;
    setIsLoading(true);
    setSessionError(null);

    try {
      const profile = await apiGet<UserProfile>("/auth/me");
      if (version === requestVersion.current) {
        setUser(profile);
      }
    } catch (error: unknown) {
      if (version === requestVersion.current) {
        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
        } else {
          setSessionError(errorMessage(error));
        }
      }
    } finally {
      if (version === requestVersion.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    const version = ++requestVersion.current;

    apiGet<UserProfile>("/auth/me")
      .then((profile) => {
        if (active && version === requestVersion.current) {
          setUser(profile);
        }
      })
      .catch((error: unknown) => {
        if (!active || version !== requestVersion.current) {
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
        } else {
          setSessionError(errorMessage(error));
        }
      })
      .finally(() => {
        if (active && version === requestVersion.current) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const authenticate = useCallback((profile: UserProfile) => {
    requestVersion.current += 1;
    setUser(profile);
    setSessionError(null);
    setIsLoading(false);
  }, []);

  const logout = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      await apiPost<void>("/auth/logout", {});
      if (version === requestVersion.current) {
        setUser(null);
        setSessionError(null);
      }
    } catch (error: unknown) {
      await refreshSession();
      throw error;
    }
  }, [refreshSession]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      sessionError,
      refreshSession,
      authenticate,
      logout,
    }),
    [user, isLoading, sessionError, refreshSession, authenticate, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
