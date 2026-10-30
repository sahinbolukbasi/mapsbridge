"use client";
import { useLocale } from "../../lib/locale-context";
import { Button } from "./button";
import { cx } from "./cx";
import { Icon } from "./material-icon";
import type { UiError } from "./logic/http-error";
import "./ui.css";

/** role="alert"; UiError (logic/http-error.ts) Türkçe başlık/metin taşır. */
export function ErrorState({
  error,
  onRetry,
  onRefresh,
  compact = false,
}: {
  error: UiError;
  onRetry?: () => void;
  onRefresh?: () => void;
  compact?: boolean;
}) {
  const { t } = useLocale();
  return (
    <div className={cx("ui-error-state", compact && "ui-error-state--compact")} role="alert">
      <Icon name="error" size={compact ? "md" : "lg"} className="ui-error-state__icon" />
      <p className="ui-error-state__title">{error.title}</p>
      <p className="ui-error-state__message">{error.message}</p>
      {error.retryable && onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t("ui.retry", "Tekrar dene")}
        </Button>
      )}
      {!error.retryable && error.action === "refresh" && onRefresh && (
        <Button variant="secondary" size="sm" onClick={onRefresh}>
          {t("ui.refresh", "Yenile")}
        </Button>
      )}
      {error.action === "login" && (
        <Button variant="link" size="sm" href="/login/">
          {t("ui.signIn", "Giriş yap")}
        </Button>
      )}
    </div>
  );
}
