"use client";
// /how-it-works/: gerçek akışın ayrıntılı anlatımı (design §10 #2 "Ayrıntılı anlatım", F6).
// Ana sayfa üç adımı özetler; burada konuşma koreografisi (spec), planlayıcı, paylaşım ve
// krediler anlatılır. SSS soruları ana sayfa SSS'inden farklıdır (F6). Metinler yalnızca kodun
// ve spec'in desteklediğini söyler: istatistik, sahte kod ya da mağaza iddiası yok (I1, S6).
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
} from "../components/ui";
import { useLocale } from "../lib/locale-context";
import "./how-it-works.css";

const TURNS = [
  { n: 1, title: "how.talk.turn1.title", body: "how.talk.turn1.body" },
  { n: 2, title: "how.talk.turn2.title", body: "how.talk.turn2.body" },
  { n: 3, title: "how.talk.turn3.title", body: "how.talk.turn3.body" },
  { n: 4, title: "how.talk.turn4.title", body: "how.talk.turn4.body" },
] as const;

type Point = { icon: IconName; title: string; body: string };

const PLANNER: readonly Point[] = [
  { icon: "calendar", title: "how.planner.days.title", body: "how.planner.days.body" },
  { icon: "grip", title: "how.planner.order.title", body: "how.planner.order.body" },
  { icon: "route", title: "how.planner.optimize.title", body: "how.planner.optimize.body" },
  { icon: "offline", title: "how.planner.device.title", body: "how.planner.device.body" },
];

const SHARING: readonly Point[] = [
  { icon: "share", title: "how.share.create.title", body: "how.share.create.body" },
  { icon: "key", title: "how.share.open.title", body: "how.share.open.body" },
  { icon: "clock", title: "how.share.expiry.title", body: "how.share.expiry.body" },
];

const INDEPENDENCE: readonly Point[] = [
  {
    icon: "shield",
    title: "how.independence.ranking.title",
    body: "how.independence.ranking.body",
  },
  { icon: "bag", title: "how.independence.prep.title", body: "how.independence.prep.body" },
];

// Ana sayfa SSS'i (home.faq.q1–q5) ile çakışmayan sorular (F6).
const FAQ = [
  { id: "nc-sss-1", q: "how.faq.q1", a: "how.faq.a1" },
  { id: "nc-sss-2", q: "how.faq.q2", a: "how.faq.a2" },
  { id: "nc-sss-3", q: "how.faq.q3", a: "how.faq.a3" },
  { id: "nc-sss-4", q: "how.faq.q4", a: "how.faq.a4" },
  { id: "nc-sss-5", q: "how.faq.q5", a: "how.faq.a5" },
] as const;

function PointList({ items }: { items: readonly Point[] }) {
  const { t } = useLocale();
  return (
    <Reveal as="ul" stagger className="hiw-points">
      {items.map((p, i) => (
        <Card as="li" key={p.title} className="hiw-points__item">
          <div className="hiw-points__inner" {...revealItem(i)}>
            <span className="hiw-points__icon">
              <Icon name={p.icon} size={24} />
            </span>
            <div>
              <h3 className="hiw-card__title">{t(p.title)}</h3>
              <p className="hiw-card__body">{t(p.body)}</p>
            </div>
          </div>
        </Card>
      ))}
    </Reveal>
  );
}

export function HowItWorksClient() {
  const { t } = useLocale();
  return (
    <PageShell
      className="hiw"
      header={
        <PageHeader
          enter
          description={t("how.lead")}
          breadcrumb={[
            { label: t("ui.breadcrumb.home", "Ana sayfa"), href: "/" },
            { label: t("how.breadcrumb", "Nasıl çalışır") },
          ]}
        />
      }
    >
      <Section id="konusma" title={t("how.talk.title")} description={t("how.talk.sub")}>
        <Reveal as="ol" stagger className="hiw-turns">
          {TURNS.map((turn, i) => (
            <Card as="li" key={turn.n} className="hiw-turns__item">
              <div className="hiw-turns__inner" {...revealItem(i)}>
                <span className="hiw-turns__num" data-surface="inverse" aria-hidden="true">
                  {turn.n}
                </span>
                <div>
                  <h3 className="hiw-card__title">{t(turn.title)}</h3>
                  <p className="hiw-card__body">{t(turn.body)}</p>
                </div>
              </div>
            </Card>
          ))}
        </Reveal>
      </Section>

      <Section id="planlayici" title={t("how.planner.title")} description={t("how.planner.sub")}>
        <PointList items={PLANNER} />
      </Section>

      <Section id="paylasim" title={t("how.share.title")} description={t("how.share.sub")}>
        <PointList items={SHARING} />
      </Section>

      <Section id="krediler" title={t("how.credits.title")} description={t("how.credits.sub")}>
        <div className="hiw-credits">
          <CreditCostTable actions={["clarify", "ai_chat", "ai_stay_dining", "ai_deep_trip"]} />
          <div>
            <Button href="/pricing/" variant="link" iconEnd={<Icon name="arrow" size={16} />}>
              {t("how.credits.cta")}
            </Button>
          </div>
        </div>
      </Section>

      <Section id="bagimsizlik" title={t("how.independence.title")}>
        <PointList items={INDEPENDENCE} />
      </Section>

      <Section id="sss" title={t("how.faq.title")}>
        <Accordion
          items={FAQ.map((item) => ({
            id: item.id,
            summary: t(item.q),
            content: <p className="hiw-card__body">{t(item.a)}</p>,
          }))}
        />
      </Section>

      <Section
        id="basla"
        title={t("how.final.title")}
        description={t("how.final.sub")}
        className="hiw-final"
      >
        <div className="hiw-actions">
          <Button href="/travel-assistant/" size="lg" iconEnd={<Icon name="arrow" size={20} />}>
            {t("how.final.assistant")}
          </Button>
          <Button href="/maps/" size="lg" variant="secondary">
            {t("how.final.planner")}
          </Button>
        </div>
      </Section>
    </PageShell>
  );
}
