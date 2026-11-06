"use client";
// Oturumlu asistanın boş sohbet karşılaması (FEAT-013). Öneriye dokunmak metni mevcut send()
// ile gönderir; ücret sunucuda belirlenir (S22), burada maliyet gösterilmez ya da hesaplanmaz.
import { Icon } from "../components/ui";
import { useLocale } from "../lib/locale-context";
import {
  ACTIVITY_STARTERS,
  POPULAR_DESTINATIONS,
  getSeasonalGuides,
  type Text,
} from "./studio-starters";

export function StudioWelcome({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick: (prompt: string) => void;
}) {
  const { t } = useLocale();
  const tx = (text: Text) => t(text[0], text[1]);
  return (
    <section className="as-studio-welcome" aria-labelledby="as-studio-welcome-title">
      <div className="as-studio-welcome__head">
        <span className="as-studio__avatar">
          <Icon name="sparkle" size={20} />
        </span>
        <div>
          <h2 id="as-studio-welcome-title" className="as-studio-welcome__title">
            {t("studio.welcome.title", "İyi günler! Nereye gitmek istersin?")}
          </h2>
          <p className="as-studio-welcome__text">
            {t(
              "studio.welcome.text",
              "Bir şehir seç ya da ne yapmak istediğini söyle; rotanı birlikte oluşturalım.",
            )}
          </p>
        </div>
      </div>

      <div className="as-studio-welcome__group">
        <h3 className="as-studio-welcome__label">
          <Icon name="plane" size={16} />
          {t("studio.welcome.destinations", "Popüler destinasyonlar")}
        </h3>
        <ul className="as-studio-welcome__grid">
          {POPULAR_DESTINATIONS.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className="as-studio-starter"
                onClick={() => onPick(tx(d.prompt))}
                disabled={busy}
              >
                <Icon name="globe" size={20} className="as-studio-starter__icon" />
                <span className="as-studio-starter__text">
                  <span className="as-studio-starter__title">{tx(d.city)}</span>
                  <span className="as-studio-starter__desc">{tx(d.country)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="as-studio-welcome__group">
        <h3 className="as-studio-welcome__label">
          <Icon name="compass" size={16} />
          {t("studio.welcome.activities", "Ne yapmak istersin?")}
        </h3>
        <ul className="as-studio-welcome__grid as-studio-welcome__grid--wide">
          {ACTIVITY_STARTERS.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="as-studio-starter"
                onClick={() => onPick(tx(a.prompt))}
                disabled={busy}
              >
                <Icon name={a.icon} size={20} className="as-studio-starter__icon" />
                <span className="as-studio-starter__text">
                  <span className="as-studio-starter__title">{tx(a.label)}</span>
                  <span className="as-studio-starter__desc">{tx(a.desc)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="as-studio-welcome__group">
        <h3 className="as-studio-welcome__label">
          <Icon name="info" size={16} />
          {t("studio.welcome.guides", "Hızlı rehberler")}
        </h3>
        <ul className="as-studio-welcome__grid">
          {getSeasonalGuides(6).map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className="as-studio-starter"
                onClick={() => onPick(tx(g.prompt))}
                disabled={busy}
              >
                <Icon name="landmark" size={20} className="as-studio-starter__icon" />
                <span className="as-studio-starter__text">
                  <span className="as-studio-starter__title">{tx(g.city)}</span>
                  <span className="as-studio-starter__desc">{tx(g.topic)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
