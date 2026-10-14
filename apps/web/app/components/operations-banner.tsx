"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api-client";
import { usePathname } from "next/navigation";
type Status = { maintenanceMode: boolean; maintenanceMessage: string; announcements: { id: string; title: string; message: string; version: number }[] };
export function OperationsBanner() {
  const path = usePathname(); const [status, setStatus] = useState<Status | null>(null); const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => { let active = true; const load = async () => { try { const result = await apiFetch<Status>("/system/status", { skipAuth: true }); if (active) setStatus(result); } catch { /* A banner outage must not block the application. */ } }; void load(); const timer = setInterval(() => { if (!document.hidden) void load(); }, 60000); return () => { active = false; clearInterval(timer); }; }, []);
  if (path.startsWith("/admin") || path.startsWith("/u/admin")) return null;
  const announcements = status?.announcements?.filter(row => !dismissed.includes(`${row.id}:${row.version}`)) || [];
  return <div className="operations-banners" aria-live="polite">{status?.maintenanceMode && <div className="operations-banner maintenance"><strong>Bakım çalışması</strong><span>{status.maintenanceMessage}</span><small>İçerikleri görüntüleyebilir ve destek talebi oluşturabilirsiniz.</small></div>}{announcements.slice(0, 3).map(row => <div className="operations-banner" key={row.id}><button aria-label="Duyuruyu kapat" onClick={() => setDismissed([...dismissed, `${row.id}:${row.version}`])}>✕</button><strong>{row.title}</strong><span>{row.message}</span></div>)}</div>;
}
