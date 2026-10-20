"use client";

import { useLocale, getAlternatePath } from "../lib/locale-context";

export function SiteControls() {
  const { isEnglish } = useLocale();

  function switchLocale() {
    const alternate = getAlternatePath(window.location.pathname);
    document.cookie = `locale=${isEnglish ? "tr" : "en"};path=/;max-age=31536000;SameSite=Lax`;
    window.location.assign(alternate);
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      className="locale-switch-btn"
      aria-label={isEnglish ? "Türkçe'ye geç" : "Switch to English"}
      title={isEnglish ? "Türkçe'ye geç" : "Switch to English"}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
        translate
      </span>
      <span>{isEnglish ? "TR" : "EN"}</span>
    </button>
  );
}
