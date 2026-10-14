"use client";

import { useEffect } from "react";
import { getStoredSession, willExpireSoon, refreshSession } from "../lib/cognito";

const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function SessionKeepAlive() {
  useEffect(() => {
    const tryRefresh = async () => {
      const session = getStoredSession();
      if (!session?.token) return;
      if (willExpireSoon(session.token, REFRESH_INTERVAL_MS)) {
        try { await refreshSession(); } catch { /* silent */ }
      }
    };

    void tryRefresh();
    const timer = setInterval(() => void tryRefresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return null;
}
