"use client";

import { useEffect, useState } from "react";
import { useLocale } from "../lib/locale-context";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
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

/** 404 ve render hatası sayfası (design §4.4 ek: PageShell + EmptyState / ErrorState + kanonik linkler). */
const POPULAR = [
  { href: "/maps/", key: "maps" },
  { href: "/travel-assistant/", key: "assistant" },
  { href: "/community/", key: "community" },
  { href: "/support/", key: "support" },
] as const;

export function NotFoundView({ isError = false, errorMessage, onRetry }: NotFoundViewProps) {
  const { t } = useLocale();
  const [attemptedPath, setAttemptedPath] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    if (path && path !== "/" && path !== "/404") setAttemptedPath(path);
  }, []);

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
          icon="explore_off"
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
            <Button href="/" prefetch={false} iconStart={<span aria-hidden="true">⌂</span>}>
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
              interactive
              href={item.href}
              linkLabel={t(`ui.notFound.link.${item.key}`)}
            >
              <p className="not-found-links__desc">{t(`ui.notFound.link.${item.key}.desc`)}</p>
            </Card>
          ))}
        </ul>
      </Section>
    </PageShell>
  );
}
