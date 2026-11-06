"use client";
// Ana sayfa (design §10, F1–F10, F41, F42; kararlar S6/S11). Metinler yalnızca §10'dan
// (home.* anahtarları); istatistik, yorum, fiyat ya da mağaza iddiası yok. Bölüm 7 (mobil)
// render edilmez (S6); SSS q4 FEAT-007'de önbellek kapsamı doğrulandıktan sonra render edilir (S11).
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Accordion,
  Button,
  Card,
  CreditCostTable,
  Icon,
  PageHeader,
  PageShell,
  Reveal,
  Section,
  revealItem,
  type IconName,
} from "./components/ui";
import { SampleRouteStage } from "./components/trip/sample-route-preview";
import { HeroPrompt, ShareCodeForm } from "./home-prompt";
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

const PACE = [
  "home.sample.pace.calm",
  "home.sample.pace.balanced",
  "home.sample.pace.busy",
] as const;

// Destinasyon kartları yalnız asistana hazır cümle verir (direction §4); mekan/fiyat iddiası yok.
// Fotoğraflar repodaki görseller; Roma kartı harita illüstrasyonu.
const DESTINATIONS = [
  {
    id: "cappadocia",
    name: "home.dest.cappadocia.name",
    prompt: "home.dest.cappadocia.prompt",
    alt: "home.dest.cappadocia.alt",
    src: "/images/kapadokya-balloons.jpg",
  },
  { id: "rome", name: "home.dest.rome.name", prompt: "home.dest.rome.prompt", alt: "", src: "" },
  {
    id: "tokyo",
    name: "home.dest.tokyo.name",
    prompt: "home.dest.tokyo.prompt",
    alt: "home.dest.tokyo.alt",
    src: "/images/tokyo-shinjuku.jpg",
  },
] as const;

// Bento: planlayıcı büyük koyu karo; diğerleri ilgili sayfaya giden etkileşimli kartlar.
const FEATURES: ReadonlyArray<{ icon: IconName; title: string; body: string; href: string }> = [
  {
    icon: "sparkle",
    title: "home.features.assistant.title",
    body: "home.features.assistant.body",
    href: "/travel-assistant/",
  },
  {
    icon: "route",
    title: "home.features.optimize.title",
    body: "home.features.optimize.body",
    href: "/maps/",
  },
  {
    icon: "shield",
    title: "home.features.share.title",
    body: "home.features.share.body",
    href: "/k/",
  },
  {
    icon: "message",
    title: "home.features.messages.title",
    body: "home.features.messages.body",
    href: "/messages/",
  },
  {
    icon: "users",
    title: "home.features.community.title",
    body: "home.features.community.body",
    href: "/community/",
  },
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
        <Contours className="home-hero__contours" variant="hero" />
        <div className="home-hero__grid">
          <div className="home-hero__copy">
            <PageHeader
              variant="hero"
              enter
              eyebrowPulse
              eyebrow={t("home.hero.eyebrow")}
              title={t("home.hero.title")}
              titleInk={t("home.hero.titleInk")}
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
            <SampleRouteStage
              photoSrc="/images/mobile-welcome-bg.jpg"
              photoAlt={t("home.hero.photoAlt")}
            />
          </div>
        </div>
      </div>

      <Section
        id="nasil-calisir"
        title={t("home.how.title")}
        size="display"
        className="home-section"
      >
        <p className="home-eyebrow home-eyebrow--clay">{t("home.how.eyebrow")}</p>
        <Reveal as="ol" stagger className="home-how">
          <svg
            className="home-how__line"
            viewBox="0 0 100 4"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0 2 H100" pathLength={1} />
          </svg>
          {STEPS.map((step, i) => (
            <li key={step.n} className="home-how__item" {...revealItem(i)}>
              <span className="home-how__num" data-surface="inverse" aria-hidden="true">
                {step.n}
              </span>
              <h3 className="home-card__title">{t(step.title)}</h3>
              <p className="home-card__body">{t(step.body)}</p>
              <div className="home-how__mini" aria-hidden="true">
                {step.n === 1 && (
                  <span className="home-how__bubble">{t("home.how.step1.mini")}</span>
                )}
                {step.n === 2 &&
                  PACE.map((key, n) => (
                    <span key={key} className="home-how__chip" data-on={n === 1 ? "" : undefined}>
                      {t(key)}
                    </span>
                  ))}
                {step.n === 3 && (
                  <>
                    <Icon name="route" size={16} />
                    {t("home.how.step3.mini")}
                  </>
                )}
              </div>
            </li>
          ))}
        </Reveal>
        <div className="home-section__more">
          <Button href="/how-it-works/" variant="link" iconEnd={<Icon name="arrow" size={16} />}>
            {t("home.how.more")}
          </Button>
        </div>
      </Section>

      <Section
        id="baslangic"
        title={t("home.dest.title")}
        description={t("home.dest.sub")}
        size="display"
        className="home-section"
      >
        <p className="home-eyebrow">{t("home.dest.eyebrow")}</p>
        <Reveal as="ul" stagger className="home-dest">
          {DESTINATIONS.map((d, i) => {
            const prompt = t(d.prompt);
            return (
              <li key={d.id} className="home-dest__item" {...revealItem(i)}>
                <Link
                  href={`/travel-assistant/?q=${encodeURIComponent(prompt)}`}
                  className="home-dest__card"
                  data-surface="inverse"
                >
                  {d.src ? (
                    <img className="home-dest__img" src={d.src} alt={t(d.alt)} loading="lazy" />
                  ) : (
                    <RomeArt />
                  )}
                  <span className="home-dest__cap">
                    <strong className="home-dest__name">{t(d.name)}</strong>
                    <span className="home-dest__cta">
                      {t("home.dest.cta").replace("{prompt}", prompt)}
                      <Icon name="arrow" size={16} className="home-dest__arrow" />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </Reveal>
      </Section>

      <Section
        id="ozellikler"
        title={t("home.features.title")}
        size="display"
        className="home-section"
      >
        <Reveal as="ul" stagger className="home-bento">
          <li className="home-bento__big" data-surface="inverse" {...revealItem(0)}>
            <span className="home-bento__icon home-bento__icon--inverse">
              <Icon name="map" size={24} />
            </span>
            <h3 className="home-card__title">
              <Link href="/maps/" className="home-bento__link">
                {t("home.features.planner.title")}
              </Link>
            </h3>
            <p className="home-bento__body">{t("home.features.planner.body")}</p>
            <div className="home-bento__days" aria-hidden="true">
              {[1, 2, 3].map((n) => (
                <span key={n} className="home-bento__day" data-day={n}>
                  <i className="home-bento__bar" />
                  {t("home.how.step3.mini").split(" · ")[n - 1]}
                </span>
              ))}
            </div>
          </li>
          {FEATURES.map((f, i) => (
            <li key={f.icon} className="home-bento__item" {...revealItem(i + 1)}>
              <span className="home-bento__icon">
                <Icon name={f.icon} size={24} />
              </span>
              <h3 className="home-card__title">
                <Link href={f.href} className="home-bento__link">
                  {t(f.title)}
                </Link>
              </h3>
              <p className="home-card__body">{t(f.body)}</p>
            </li>
          ))}
        </Reveal>
      </Section>

      <div className="home-band" data-surface="inverse">
        <Contours className="home-band__contours" variant="band" />
        <Section
          id="bagimsizlik"
          title={t("home.independence.title")}
          description={t("home.independence.sub")}
          size="display"
          className="home-section home-section--band"
        >
          <Reveal as="ul" stagger className="home-points">
            {INDEPENDENCE.map((p, i) => (
              <li key={p.title} className="home-points__item" {...revealItem(i)}>
                <Icon name={POINT_ICONS[i]} size={24} className="home-points__icon" />
                <div>
                  <h3 className="home-card__title">{t(p.title)}</h3>
                  <p className="home-points__body">{t(p.body)}</p>
                </div>
              </li>
            ))}
          </Reveal>
        </Section>
      </div>

      <Section
        id="krediler"
        title={t("home.credits.title")}
        description={t("home.credits.sub")}
        size="display"
        className="home-section home-section--split"
      >
        <Reveal className="home-credits">
          <CreditCostTable />
          <div className="home-section__more">
            <Button href="/pricing/" variant="link" iconEnd={<Icon name="arrow" size={16} />}>
              {t("home.credits.cta")}
            </Button>
          </div>
        </Reveal>
      </Section>

      <Section
        id="paylasim"
        title={t("home.share.title")}
        description={t("home.share.sub")}
        size="display"
        className="home-section home-section--split"
      >
        <Reveal>
          <Card variant="raised" className="home-share-card">
            <ShareCodeForm idPrefix="paylasim" />
          </Card>
        </Reveal>
      </Section>

      <Section
        id="sss"
        title={t("home.faq.title")}
        size="display"
        className="home-section home-section--narrow"
      >
        <Reveal className="home-narrow-card">
          <Card>
            <Accordion
              items={FAQ.map((item) => ({
                id: item.id,
                summary: t(item.q),
                content: <p className="home-card__body">{t(item.a)}</p>,
              }))}
            />
          </Card>
        </Reveal>
      </Section>

      <Section
        id="son"
        title={t("home.final.title")}
        size="display"
        className="home-section home-section--final"
      >
        <Reveal className="home-narrow-card">
          <Card variant="raised" className="home-final-card">
            <HeroPrompt idPrefix="son" />
          </Card>
        </Reveal>
      </Section>
    </PageShell>
  );
}

const POINT_ICONS: ReadonlyArray<IconName> = ["shield", "bag", "check"];

/** Kartograf kontur motifi (dekoratif; yavaş kayma yalnız no-preference, ≥5 sn döngü). */
function Contours({ className, variant }: { className: string; variant: "hero" | "band" }) {
  const paths =
    variant === "hero"
      ? [
          "M-50 420 C 200 360, 380 470, 620 400 S 1000 300, 1260 360",
          "M-50 460 C 220 400, 400 510, 640 440 S 1010 340, 1260 400",
          "M-50 500 C 240 440, 420 550, 660 480 S 1020 380, 1260 440",
          "M-50 120 C 160 80, 360 170, 580 110 S 960 40, 1260 90",
          "M-50 160 C 180 120, 380 210, 600 150 S 980 80, 1260 130",
          "M820 260 c 60 -60, 180 -40, 200 30 s -80 120, -160 90 s -100 -60, -40 -120Z",
          "M850 265 c 40 -35, 120 -25, 135 20 s -55 80, -105 60 s -65 -40, -30 -80Z",
        ]
      : [
          "M-50 300 C 200 240, 380 350, 620 280 S 1000 180, 1260 240",
          "M-50 340 C 220 280, 400 390, 640 320 S 1010 220, 1260 280",
          "M-50 80 C 160 40, 360 130, 580 70 S 960 0, 1260 50",
        ];
  return (
    <svg
      className={className}
      viewBox={variant === "hero" ? "0 0 1200 600" : "0 0 1200 400"}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Roma kartı: fotoğraf yerine örnek harita illüstrasyonu (dekoratif). */
function RomeArt() {
  return (
    <svg
      className="home-dest__art"
      viewBox="0 0 300 375"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="300" height="375" className="home-art__land" />
      <path
        className="home-art__water"
        d="M0 290 C 70 260, 130 320, 200 290 S 280 270, 300 300 V375 H0Z"
      />
      <path className="home-art__park" d="M180 40 h90 v80 h-90Z" />
      <path className="home-art__road-case" d="M0 170 H300 M90 0 V375 M220 0 L 190 375" />
      <path className="home-art__road" d="M0 170 H300 M90 0 V375 M220 0 L 190 375" />
      <path
        className="home-art__route-case"
        d="M50 250 C 90 200, 120 180, 160 170 S 220 120, 250 80"
      />
      <path className="home-art__route" d="M50 250 C 90 200, 120 180, 160 170 S 220 120, 250 80" />
      <circle className="home-art__stop" cx="50" cy="250" r="9" />
      <circle className="home-art__stop" cx="160" cy="170" r="9" />
      <circle className="home-art__stop" cx="250" cy="80" r="9" />
    </svg>
  );
}
