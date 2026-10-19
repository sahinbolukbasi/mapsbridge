"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  getStoredSession,
  isTokenExpired,
  migrateLegacyStorageKeys,
  refreshSession,
  signOut as cognitoSignOut,
  getUserProfile,
  type UserProfile,
} from "./cognito";

export interface AuthUser {
  token: string;
  email: string;
  profile: UserProfile | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  signOut: () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSession = useCallback(async () => {
    // Eski key'leri otomatik migrate et
    migrateLegacyStorageKeys();

    const session = getStoredSession();
    if (!session) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    // Token süresi dolmuşsa refresh dene
    if (isTokenExpired(session.token)) {
      const refreshed = await refreshSession();
      if (!refreshed) {
        cognitoSignOut();
        document.cookie = "mb_session=; Max-Age=0; path=/";
        setUser(null);
        setIsLoading(false);
        return;
      }
      document.cookie = `mb_session=1; Max-Age=${24 * 60 * 60}; path=/; SameSite=Strict`;
      setUser({
        token: refreshed.token,
        email: session.email,
        profile: getUserProfile(),
      });
    } else {
      document.cookie = `mb_session=1; Max-Age=${24 * 60 * 60}; path=/; SameSite=Strict`;
      setUser({
        token: session.token,
        email: session.email,
        profile: getUserProfile(),
      });
    }
    setIsLoading(false);
  }, []);

  // İlk yükleme
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // api-client 401 kalıcı olduğunda kullanıcıyı login sayfasına yönlendir
  useEffect(() => {
    const handleExpired = () => {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login/?next=${next}`);
    };
    window.addEventListener("mapsbridge:session-expired", handleExpired);
    return () => window.removeEventListener("mapsbridge:session-expired", handleExpired);
  }, []);

  // 30 dakikada bir token refresh (SessionKeepAlive'ın yerini alır)
  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      const session = getStoredSession();
      if (!session) return;
      if (isTokenExpired(session.token)) {
        const refreshed = await refreshSession();
        if (refreshed) {
          document.cookie = `mb_session=1; Max-Age=${24 * 60 * 60}; path=/; SameSite=Strict`;
          setUser((prev) => (prev ? { ...prev, token: refreshed.token } : null));
        } else {
          cognitoSignOut();
          document.cookie = "mb_session=; Max-Age=0; path=/";
          setUser(null);
        }
      }
    }, 30 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleSignOut = useCallback(() => {
    cognitoSignOut();
    setUser(null);
    // mb_session cookie'yi temizle (middleware için)
    document.cookie = "mb_session=; Max-Age=0; path=/";
    window.location.assign("/");
  }, []);

  const refresh = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signOut: handleSignOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
