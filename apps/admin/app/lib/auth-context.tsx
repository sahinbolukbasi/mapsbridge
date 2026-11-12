"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { AdminRole, AdminSession, AdminUser } from "./types";

interface AuthContextType {
  session: AdminSession | null;
  loading: boolean;
  login: (email: string, password: string, otp?: string) => Promise<{ success: boolean; requiresMfa?: boolean; error?: string }>;
  verifyMfa: (otp: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasRole: (roles: AdminRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_STORAGE_KEY = "mapsbridge_admin_auth_v1";

const DEMO_ADMIN_USER: AdminUser = {
  sub: "usr_admin_master_001",
  email: "admin@mapsbridge.com",
  name: "Şahin Bölükbaşı (Super Admin)",
  role: "SUPER_ADMIN",
  mfaEnabled: true,
  lastLogin: new Date().toISOString(),
};

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingUser, setPendingUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const parsed: AdminSession = JSON.parse(raw);
        if (parsed.expiresAt > Date.now()) {
          setSession(parsed);
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string, otp?: string) => {
      // Input sanitization & checks
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.includes("@")) {
        return { success: false, error: "Geçerli bir kurumsal e-posta adresi girin." };
      }
      if (!password || password.length < 6) {
        return { success: false, error: "Şifre en az 6 karakter olmalıdır." };
      }

      // 2FA / MFA Check
      if (!otp) {
        setPendingUser(DEMO_ADMIN_USER);
        return { success: false, requiresMfa: true };
      }

      // Verify OTP (any 6 digit OTP accepted for authorized demo or standard 123456)
      if (otp.length !== 6 || !/^\d+$/.test(otp)) {
        return { success: false, error: "Geçersiz 6 haneli doğrulama kodu." };
      }

      const newSession: AdminSession = {
        token: `adm_tok_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        user: { ...DEMO_ADMIN_USER, email: cleanEmail },
        expiresAt: Date.now() + 1000 * 60 * 60 * 8, // 8 hours session
      };

      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
      } catch {}

      setSession(newSession);
      setPendingUser(null);
      return { success: true };
    },
    [],
  );

  const verifyMfa = useCallback(
    async (otp: string) => {
      if (!pendingUser) {
        return { success: false, error: "Bekleyen oturum bulunamadı. Lütfen tekrar giriş yapın." };
      }
      if (otp.length !== 6 || !/^\d+$/.test(otp)) {
        return { success: false, error: "Geçersiz 6 haneli doğrulama kodu." };
      }

      const newSession: AdminSession = {
        token: `adm_tok_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        user: pendingUser,
        expiresAt: Date.now() + 1000 * 60 * 60 * 8,
      };

      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
      } catch {}

      setSession(newSession);
      setPendingUser(null);
      return { success: true };
    },
    [pendingUser],
  );

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
    setSession(null);
    setPendingUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }, []);

  const hasRole = useCallback(
    (roles: AdminRole[]) => {
      if (!session?.user) return false;
      if (session.user.role === "SUPER_ADMIN") return true;
      return roles.includes(session.user.role);
    },
    [session],
  );

  return (
    <AuthContext.Provider value={{ session, loading, login, verifyMfa, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return context;
}

