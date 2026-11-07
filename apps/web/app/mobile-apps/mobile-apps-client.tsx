"use client";
// /mobile-apps/ (design F7, karar S6). Mağaza durumu bilinmiyor: yalnızca parite hedefi
// anlatılır (home.mobile.sub ile aynı ifade) ve bugün telefon tarayıcısında çalışanlar listelenir.
// Mağaza rozeti, indirme düğmesi, sürüm numarası ya da çıkış tarihi vaadi render edilmez;
// MOBILE_APP_STATUS "available" olmadan mağaza iddiası yok (lib/mobile-app-status.ts).
import {
  Button,
  Card,
  Icon,
  PageHeader,
  PageShell,
  Section,
  type IconName,
} from "../components/ui";
import { useLocale } from "../lib/locale-context";
import { showStoreClaims } from "../lib/mobile-app-status";
import "./mobile-apps.css";

const TODAY: ReadonlyArray<{ icon: IconName; title: string; body: string }> = [
  { icon: "map", title: "mobileApps.today.planner.title", body: "mobileApps.today.planner.body" },
  {
    icon: "sparkle",
    title: "mobileApps.today.assistant.title",
    body: "mobileApps.today.assistant.body",
  },
  { icon: "key", title: "mobileApps.today.share.title", body: "mobileApps.today.share.body" },
  { icon: "user", title: "mobileApps.today.account.title", body: "mobileApps.today.account.body" },
];

export default function MobileAppsClient() {
  const { t } = useLocale();
  // S6: teyit edilene kadar "uygulamada" denmez; hedef olarak anlatılır.
  const parity = showStoreClaims() ? t("home.mobile.sub") : t("mobileApps.parity.goal");
  return (
    <PageShell
      className="mobile-apps"
      header={
        <PageHeader
          enter
          description={t("mobileApps.lead")}
          breadcrumb={[
            { label: t("ui.breadcrumb.home", "Ana sayfa"), href: "/" },
            { label: t("mobileApps.breadcrumb", "Mobil uygulamalar") },
          ]}
        />
      }
    >
      <Section reveal id="parite" title={t("mobileApps.parity.title")}>
        <Card className="mobile-apps__parity">
          <div className="mobile-apps__parity-inner">
            <span className="mobile-apps__icon">
              <Icon name="globe" size={24} />
            </span>
            <div>
              <p className="mobile-apps__lead">{parity}</p>
              <p className="mobile-apps__body">{t("mobileApps.parity.body")}</p>
            </div>
          </div>
        </Card>
      </Section>

      <Section
        reveal
        id="bugun"
        title={t("mobileApps.today.title")}
        description={t("mobileApps.today.sub")}
      >
        <ul className="mobile-apps__list">
          {TODAY.map((item) => (
            <Card as="li" key={item.title} className="mobile-apps__item">
              <div className="mobile-apps__item-inner">
                <span className="mobile-apps__icon">
                  <Icon name={item.icon} size={24} />
                </span>
                <div>
                  <h3 className="mobile-apps__title">{t(item.title)}</h3>
                  <p className="mobile-apps__body">{t(item.body)}</p>
                </div>
              </div>
            </Card>
          ))}
        </ul>
        <div className="mobile-apps__actions">
          <Button href="/maps/" size="lg" iconEnd={<Icon name="arrow" size={20} />}>
            {t("mobileApps.cta.planner")}
          </Button>
          <Button href="/travel-assistant/" size="lg" variant="secondary">
            {t("mobileApps.cta.assistant")}
          </Button>
        </div>
      </Section>
    </PageShell>
  );
}
