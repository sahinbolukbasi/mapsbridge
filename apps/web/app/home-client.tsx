"use client";
// Ana sayfa (design §10, F1–F10, F41, F42; kararlar S6/S11). Metinler yalnızca §10'dan
// (home.* anahtarları); istatistik, yorum, fiyat ya da mağaza iddiası yok. Bölüm 7 (mobil)
// render edilmez (S6); SSS q4 FEAT-007'de önbellek kapsamı doğrulandıktan sonra render edilir (S11).
import { useEffect, useState, type ReactNode } from "react";
import {
  Accordion,
  Button,
  Card,
  CreditCostTable,
  Icon,
  PageHeader,
  PageShell,
  Section,
  type IconName,
} from "./components/ui";
import { SampleRoutePreview } from "./components/trip/sample-route-preview";
import { HeroPrompt, ShareCodeForm } from "./home-prompt";
import { useReveal } from "./components/ui/hooks/use-reveal";
import { getStoredSession } from "./lib/cognito";
import { useLocale } from "./lib/locale-context";
import { PLANNER_TRIPS_KEY, summarizeLastTrip, type LastTripSummary } from "./lib/trip/last-trip";
import { readPlannerStore } from "./lib/trip/planner-store";
import "./home.css";

const STEPS = [
  { n: 1, title: "home.how.step1.title", body: "home.how.step1.body" },
  { n: 2, title: "home.how.step2.title", body: "home.how.step2.body" },
  { n: 3, title: "home.how.step3.title", body: "home.how.step3.body" },
] as const;

const FEATURES: ReadonlyArray<{ icon: IconName; title: string; body: string }> = [
  { icon: "map", title: "home.features.planner.title", body: "home.features.planner.body" },
  { icon: "route", title: "home.features.optimize.title", body: "home.features.optimize.body" },
  { icon: "sparkle", title: "home.features.assistant.title", body: "home.features.assistant.body" },
  { icon: "shield", title: "home.features.share.title", body: "home.features.share.body" },
  { icon: "message", title: "home.features.messages.title", body: "home.features.messages.body" },
  { icon: "users", title: "home.features.community.title", body: "home.features.community.body" },
];

const INDEPENDENCE = [
  { title: "home.independence.p1.title", body: "home.independence.p1.body" },
  { title: "home.independence.p2.title", body: "home.independence.p2.body" },
  { title: "home.independence.p3.title", body: "home.independence.p3.body" },
] as const;

// q4 (çevrimdışı, I12): FEAT-007 önbellek kapsamını doğruladı (S11). Yalnızca
// use-travel-planner'ın localStorage'a yazdığı alanları iddia eder: duraklar, koordinatlar,
// gün ve sıra. Yol geometrisi/yön tarifi ve harita karoları saklanmaz; service worker yok.
const FAQ = [
  { id: "sss-1", q: "home.faq.q1", a: "home.faq.a1" },
  { id: "sss-2", q: "home.faq.q2", a: "home.faq.a2" },
  { id: "sss-3", q: "home.faq.q3", a: "home.faq.a3" },
  { id: "sss-4", q: "home.faq.q4", a: "home.faq.a4" },
  { id: "sss-5", q: "home.faq.q5", a: "home.faq.a5" },
] as const;

const TRUST = ["home.hero.trust.ranking", "home.hero.trust.credits", "home.hero.trust.welcome"];

/** Bölüm görünür alana girince bir kez belirir (components/ui/hooks/use-reveal; JS'siz baştan görünür). */
function Reveal({ children }: { children: ReactNode }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="home-reveal">
      {children}
    </div>
  );
}

export default function Home() {
  const { t } = useLocale();
  const [signedIn, setSignedIn] = useState(false);
  const [lastTrip, setLastTrip] = useState<LastTripSummary | null>(null);

  // Oturum ve son gezi yalnızca mount sonrası okunur (statik HTML misafir görünümüdür).
  useEffect(() => {
    if (!getStoredSession()?.token) return;
    setSignedIn(true);
    try {
      setLastTrip(summarizeLastTrip(readPlannerStore(PLANNER_TRIPS_KEY)));
    } catch {
      setLastTrip(null);
    }
  }, []);

  return (
    <PageShell className="home">
      <div id="basla" className="home-hero">
        <div className="home-hero__copy">
          <PageHeader
            variant="hero"
            eyebrow={t("home.hero.eyebrow")}
            title={t("home.hero.title")}
            description={t("home.hero.sub")}
          >
            {signedIn && (
              <div className="home-hero__resume">
                <Button href="/maps/" size="lg" iconEnd={<Icon name="arrow" size={20} />}>
                  {t("home.hero.resume")}
                </Button>
              </div>
            )}
            {signedIn && lastTrip && (
              <Card variant="bordered" padding="sm" className="home-last-trip">
                <p className="home-last-trip__label">{t("home.lastTrip.title")}</p>
                <p className="home-last-trip__title">{lastTrip.title}</p>
                <p className="home-last-trip__meta">
                  {t(
                    lastTrip.stops === 1 ? "home.lastTrip.stops.one" : "home.lastTrip.stops",
                  ).replace("{n}", String(lastTrip.stops))}
                </p>
                <Button href="/maps/" variant="link">
                  {t("home.lastTrip.open")}
                </Button>
              </Card>
            )}
            <HeroPrompt
              idPrefix="hero"
              withChips
              submitVariant={signedIn ? "secondary" : "primary"}
            />
            <ul className="home-trust">
              {TRUST.map((key) => (
                <li key={key} className="home-trust__item">
                  <Icon name="check" size={16} className="home-trust__icon" />
                  {t(key)}
                </li>
              ))}
            </ul>
          </PageHeader>
        </div>
        <div className="home-hero__proof">
          <SampleRoutePreview />
        </div>
      </div>

      <Reveal>
        <Section id="nasil-calisir" title={t("home.how.title")} className="home-section">
          <p className="home-eyebrow">{t("home.how.eyebrow")}</p>
          <ol className="home-steps">
            {STEPS.map((step) => (
              <Card as="li" key={step.n} className="home-steps__item">
                <div className="home-steps__inner">
                  <span className="home-steps__num" aria-hidden="true">
                    {step.n}
                  </span>
                  <h3 className="home-card__title">{t(step.title)}</h3>
                  <p className="home-card__body">{t(step.body)}</p>
                </div>
              </Card>
            ))}
          </ol>
          <div className="home-section__more">
            <Button href="/how-it-works/" variant="link" iconEnd={<Icon name="arrow" size={16} />}>
              {t("home.how.more")}
            </Button>
          </div>
        </Section>
      </Reveal>

      <Reveal>
        <Section id="ozellikler" title={t("home.features.title")} className="home-section">
          <ul className="home-features">
            {FEATURES.map((f) => (
              <Card as="li" key={f.icon} className="home-features__item">
                <div className="home-features__inner">
                  <span className="home-features__icon">
                    <Icon name={f.icon} size={24} />
                  </span>
                  <div className="home-features__text">
                    <h3 className="home-card__title">{t(f.title)}</h3>
                    <p className="home-card__body">{t(f.body)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </ul>
        </Section>
      </Reveal>

      <Reveal>
        <div className="home-band" data-surface="inverse">
          <Section
            id="bagimsizlik"
            title={t("home.independence.title")}
            description={t("home.independence.sub")}
            className="home-section home-section--band"
          >
            <ul className="home-points">
              {INDEPENDENCE.map((p) => (
                <li key={p.title} className="home-points__item">
                  <Icon name="check" size={24} className="home-points__icon" />
                  <div>
                    <h3 className="home-card__title">{t(p.title)}</h3>
                    <p className="home-points__body">{t(p.body)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </Reveal>

      <Reveal>
        <Section
          id="krediler"
          title={t("home.credits.title")}
          description={t("home.credits.sub")}
          className="home-section home-section--split"
        >
          <div className="home-credits">
            <CreditCostTable />
            <div className="home-section__more">
              <Button href="/pricing/" variant="link" iconEnd={<Icon name="arrow" size={16} />}>
                {t("home.credits.cta")}
              </Button>
            </div>
          </div>
        </Section>
      </Reveal>

      <Reveal>
        <Section
          id="paylasim"
          title={t("home.share.title")}
          description={t("home.share.sub")}
          className="home-section home-section--split"
        >
          <ShareCodeForm idPrefix="paylasim" />
        </Section>
      </Reveal>

      <Reveal>
        <Section id="sss" title={t("home.faq.title")} className="home-section home-section--narrow">
          <Card className="home-narrow-card">
            <Accordion
              items={FAQ.map((item) => ({
                id: item.id,
                summary: t(item.q),
                content: <p className="home-card__body">{t(item.a)}</p>,
              }))}
            />
          </Card>
        </Section>
      </Reveal>

      <Reveal>
        <Section
          id="son"
          title={t("home.final.title")}
          className="home-section home-section--final"
        >
          <Card className="home-narrow-card">
            <HeroPrompt idPrefix="son" />
          </Card>
        </Section>
      </Reveal>
    </PageShell>
  );
}
