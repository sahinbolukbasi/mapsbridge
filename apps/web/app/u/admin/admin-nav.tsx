"use client";
// Gruplu kenar menüsü (design §8.3): grup başlığı nav içi <p> + aria-labelledby (h2 değil),
// etkin alan aria-current="page", altta rol etiketi ve uygulamaya dönüş (/maps/, M8).
import { useEffect, useId, useRef, type MouseEvent } from "react";
import { Button } from "../../components/ui";
import type { AdminAreaId } from "../../lib/admin/endpoints";
import { ROLE_LABELS } from "./format";

export const AREA_LABELS: Record<AdminAreaId, string> = {
  genel: "Genel bakış",
  kullanicilar: "Kullanıcılar",
  moderasyon: "Moderasyon",
  icerik: "İçerik",
  destek: "Destek",
  finans: "Finans",
  fiyatlandirma: "Fiyatlandırma ve kredi",
  ai: "AI operasyonları",
  analitik: "Analitik",
  sistem: "Sistem",
  gecmis: "İşlem geçmişi",
};

const GROUPS: Array<{ label: string; areas: AdminAreaId[] }> = [
  { label: "Operasyon", areas: ["genel", "kullanicilar", "moderasyon", "icerik", "destek"] },
  { label: "Gelir", areas: ["finans", "fiyatlandirma"] },
  { label: "Platform", areas: ["ai", "analitik", "sistem", "gecmis"] },
];

export function AdminNav({
  areas,
  active,
  role,
  onSelect,
}: {
  areas: AdminAreaId[];
  active: AdminAreaId;
  role: string;
  onSelect: (area: AdminAreaId) => void;
}) {
  const base = useId();
  const navRef = useRef<HTMLElement>(null);
  // Dar ekranda menü yatay kayar: etkin alan görünür kalsın (yalnızca menü kaydırılır, sayfa değil).
  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && link && nav.scrollWidth > nav.clientWidth)
      nav.scrollLeft = Math.max(0, link.offsetLeft - nav.clientWidth / 3);
  }, [active, areas]);
  const go = (area: AdminAreaId) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onSelect(area);
  };
  return (
    <nav ref={navRef} className="admin-nav" aria-label="Yönetim bölümleri">
      {GROUPS.map((group, g) => {
        const items = group.areas.filter((a) => areas.includes(a));
        if (!items.length) return null;
        const labelId = `${base}-group-${g}`;
        return (
          <div key={group.label} className="admin-nav__group">
            <p id={labelId} className="admin-nav__group-label">
              {group.label}
            </p>
            <ul className="admin-nav__list" aria-labelledby={labelId}>
              {items.map((area) => (
                <li key={area}>
                  <a
                    href={`/u/admin/?alan=${area}`}
                    className="admin-nav__link"
                    aria-current={area === active ? "page" : undefined}
                    onClick={go(area)}
                  >
                    {AREA_LABELS[area]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <div className="admin-nav__footer">
        <p className="admin-nav__role">
          Rol: <strong>{ROLE_LABELS[role] ?? role}</strong>
        </p>
        <p className="admin-nav__note">Veriler 60 saniyede bir yenilenir.</p>
        <Button variant="link" size="sm" href="/maps/">
          Uygulamaya dön
        </Button>
      </div>
    </nav>
  );
}
