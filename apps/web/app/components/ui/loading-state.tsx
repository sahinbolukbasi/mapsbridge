"use client";
import type { ReactNode } from "react";
import { useLocale } from "../../lib/locale-context";
import "./ui.css";

/** aria-busy + role="status" içinde görünmez etiket; skeleton yalnızca görseldir. */
export function LoadingState({ label, skeleton }: { label?: string; skeleton?: ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="ui-loading-state" role="status" aria-busy="true">
      <span className="ui-visually-hidden">{label ?? t("ui.loading", "Yükleniyor…")}</span>
      {skeleton ?? <span className="ui-loading-state__spinner" aria-hidden="true" />}
    </div>
  );
}
