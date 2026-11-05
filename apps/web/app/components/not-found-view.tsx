"use client";

import { useEffect, useState } from "react";
import { useLocale } from "../lib/locale-context";
import { findRoute, routeLabel, type RoutePath } from "../lib/route-registry";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  PageShell,
  Section,
  type UiError,
} from "./ui";
import "./not-found-view.css";

interface NotFoundViewProps {
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

/**
 * 404 ve render hatası sayfası (design §4.4 ek: PageShell + EmptyState / ErrorState). Bağlantı
 * etiketleri registry'den (routeLabel: Planla, Asistan, Topluluk, Yardım ve destek), açıklamalar
 * i18n'den gelir; URL'ler kanoniktir.
 */
const POPULAR: ReadonlyArray<{ href: RoutePath; key: string }> = [
  { href: "/maps/", key: "maps" },
  { href: "/travel-assistant/", key: "assistant" },
  { href: "/community/", key: "community" },
  { href: "/support/", key: "support" },
];

export function NotFoundView({ isError = false, errorMessage, onRetry }: NotFoundViewProps) {
  const { t, locale } = useLocale();
  const [attemptedPath, setAttemptedPath] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    if (path && path !== "/" && path !== "/404") setAttemptedPath(path);
  }, []);

  const labelOf = (href: RoutePath) => {
    const route = findRoute(href);
    return route ? routeLabel(route, locale) : href;
  };
  const uiError: UiError = {
    kind: "unknown",
    title: t("ui.errorPage.title", "Bir şeyler ters gitti"),
    message: errorMessage || t("ui.unexpectedError", "Beklenmedik bir hata oluştu."),
    retryable: Boolean(onRetry),
  };

  return (
    <PageShell
      layout="content"
      className="not-found-page"
      header={
        <PageHeader
          title={
            isError
              ? t("ui.errorPage.title", "Bir şeyler ters gitti")
              : t("ui.notFound.title", "Sayfa bulunamadı")
          }
        />
      }
    >
      {isError ? (
        <ErrorState error={uiError} onRetry={onRetry} />
      ) : (
        <EmptyState
          icon="compass"
          title={t("ui.notFound.heading", "Aradığınız durak haritada bulunamadı")}
          description={
            <>
              {attemptedPath && (
                <>
                  <code className="not-found-path">{attemptedPath}</code>{" "}
                </>
              )}
              {t(
                "ui.notFound.description",
                "Sayfa taşınmış ya da kaldırılmış olabilir. Aşağıdaki bağlantılardan devam edebilirsiniz.",
              )}
            </>
          }
          action={
            <Button href="/" prefetch={false} iconStart={<Icon name="home" size={16} />}>
              {t("ui.notFound.home", "Ana sayfaya dön")}
            </Button>
          }
        />
      )}
      <Section title={t("ui.notFound.popular", "Popüler sayfalar")}>
        <ul className="not-found-links">
          {POPULAR.map((item) => (
            <Card
              as="li"
              key={item.href}
              variant="interactive"
              href={item.href}
              linkLabel={labelOf(item.href)}
            >
              <p className="not-found-links__desc">{t(`ui.notFound.link.${item.key}.desc`)}</p>
            </Card>
          ))}
        </ul>
      </Section>
    </PageShell>
  );
}
