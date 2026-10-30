"use client";
import type { MouseEvent } from "react";
import { useLocale } from "../../lib/locale-context";
/**
 * İlk Tab durağı (AC-9). Odaklanınca görünür (stil base.css `.ui-skip-link`); hedef PageShell
 * `<main id="main-content" tabIndex={-1}>`. PageShell'e henüz geçmemiş sayfalarda (C8–C14 öncesi)
 * ilk `<main>` öğesine düşer, böylece bağlantı hiçbir sayfada boşa gitmez.
 */
export function SkipLink({ targetId = "main-content" }: { targetId?: string }) {
  const { t } = useLocale();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(targetId) ?? document.querySelector("main");
    if (!target) return;
    e.preventDefault();
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus();
    target.scrollIntoView({ block: "start" });
  };
  return (
    <a className="ui-skip-link" href={`#${targetId}`} onClick={onClick}>
      {t("ui.skipToContent", "İçeriğe geç")}
    </a>
  );
}
