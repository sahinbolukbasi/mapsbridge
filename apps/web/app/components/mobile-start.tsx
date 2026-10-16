"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredSession } from "../lib/cognito";
import "./mobile-start.css";

function StartIcon({
  kind,
}: {
  kind: "spark" | "map" | "route" | "people" | "arrow" | "sparkles";
}) {
  const paths = {
    spark: "m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z",
    sparkles: "M12 3l1.9 4.6L18 9l-4.1 1.4L12 15l-1.9-4.6L6 9l4.1-1.4L12 3z",
    map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6m6-3v15m6-12v15",
    route: "M5 5a2 2 0 1 0 0 .01M19 19a2 2 0 1 0 0 .01M7 5h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h8",
    people:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 4a4 4 0 0 1 0 8m5 9v-2a4 4 0 0 0-3-4",
    arrow: "M5 12h14m-6-6 6 6-6 6",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind]} />
    </svg>
  );
}

export function MobileStart() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const session = getStoredSession();
    if (session?.token) {
      setIsLoggedIn(true);
    }
  }, []);

  return (
    <main className="mobile-start" aria-label="Seyahat başlangıcı">
      <div className="mobile-start-heading">
        <span>YENİ BİR KEŞİF</span>
        <h1>Bugün nereye?</h1>
        <p>Seyahatini planla, rotanı yanında taşı.</p>
      </div>

      <section className="mobile-plan-card" aria-labelledby="mobile-plan-title">
        <div className="mobile-plan-title">
          <StartIcon kind="spark" />
          <h2 id="mobile-plan-title">Birlikte planlayalım</h2>
        </div>
        <p>Şehri ve aklındaki geziyi yaz. Gerisini birlikte netleştirelim.</p>
        <form action="/ai/" method="get">
          <label htmlFor="mobile-trip-query">Nereye gitmek istiyorsun?</label>
          <input
            id="mobile-trip-query"
            name="q"
            placeholder="Örn. İstanbul'da bir hafta sonu"
            maxLength={500}
            enterKeyHint="go"
          />
          <button type="submit">
            Seyahat planla <StartIcon kind="arrow" />
          </button>
        </form>
      </section>

      <section className="mobile-shortcuts" aria-label="Hızlı işlemler">
        <Link href="/desk/" prefetch={false}>
          <span>
            <StartIcon kind="map" />
          </span>
          <strong>Haritayı aç</strong>
          <small>Durak ekle, keşfe çık</small>
        </Link>
        <Link href={isLoggedIn ? "/profile/?tab=routes" : "/register/"} prefetch={false}>
          <span>
            <StartIcon kind="route" />
          </span>
          <strong>{isLoggedIn ? "Rotalarım" : "Kayıt Ol"}</strong>
          <small>{isLoggedIn ? "Planlarına devam et" : "Ücretsiz hesap oluştur"}</small>
        </Link>
      </section>

      <Link className="mobile-community-link" href="/community/" prefetch={false}>
        <StartIcon kind="people" />
        <span>
          <strong>Birlikte keşfet</strong>
          <small>Gezginler ve yeni rotalar</small>
        </span>
        <StartIcon kind="arrow" />
      </Link>

      <div className="mobile-start-links">
        <Link href="/how-it-works/">Nasıl çalışır?</Link>
        {isLoggedIn ? (
          <Link href="/support/">Yardım ve destek</Link>
        ) : (
          <Link href="/login/">Giriş Yap</Link>
        )}
      </div>
    </main>
  );
}
