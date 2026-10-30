"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "../../lib/locale-context";
import { cx } from "./cx";
import { IconButton } from "./icon-button";
import "./ui.css";

export type ToastTone = "info" | "success" | "warning" | "danger";
type ToastAction = { label: string; onClick: () => void };
/**
 * Aksiyonlu toast otomatik kapanmaz (WCAG 2.2.1) ve aynı aksiyon sayfada kalıcı bir yerde de
 * bulunmalıdır: `actionAlsoAt` bunu belgeler (yalnız dokümantasyon/test).
 */
export type ToastInput =
  | { tone?: ToastTone; message: string; durationMs?: number; action?: undefined }
  | { tone?: ToastTone; message: string; action: ToastAction; actionAlsoAt: string };
type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
  durationMs?: number;
};

type ToastApi = { show: (t: ToastInput) => number; dismiss: (id: number) => void };
const ToastContext = createContext<ToastApi | null>(null);
const DEFAULT_DURATION = 6000;

/** Toaster yoksa (C6 öncesi) çağrılar sessizce yok sayılır. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { show: () => -1, dismiss: () => undefined };
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const { t } = useLocale();
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.durationMs ?? DEFAULT_DURATION);
  useEffect(() => {
    if (item.action || paused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [item, paused, onDismiss]);
  return (
    <div
      className={cx("ui-toast", `ui-toast--${item.tone}`)}
      data-surface="default"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDismiss(item.id);
      }}
    >
      <p className="ui-toast__message">{item.message}</p>
      {item.action && (
        <button
          type="button"
          className="ui-button ui-button--link ui-button--sm"
          onClick={() => {
            item.action?.onClick();
            onDismiss(item.id);
          }}
        >
          <span className="ui-button__label">{item.action.label}</span>
        </button>
      )}
      <IconButton
        icon="close"
        label={t("ui.close", "Kapat")}
        size="sm"
        onClick={() => onDismiss(item.id)}
      />
    </div>
  );
}

/** SiteChrome'da tek örnek (C6). Kalıcı canlı bölgeler sayfa yüklenirken DOM'dadır. */
export function Toaster({ children }: { children?: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback(
    (id: number) => setItems((list) => list.filter((i) => i.id !== id)),
    [],
  );
  const show = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    setItems((list) => [
      ...list,
      {
        id,
        tone: input.tone ?? "info",
        message: input.message,
        action: input.action,
        durationMs: input.action ? undefined : input.durationMs,
      },
    ]);
    return id;
  }, []);
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const polite = items.filter((i) => i.tone !== "danger");
  const assertive = items.filter((i) => i.tone === "danger");
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ui-toaster">
        <div className="ui-toaster__region" aria-live="polite" aria-atomic="false">
          {polite.map((i) => (
            <ToastView key={i.id} item={i} onDismiss={dismiss} />
          ))}
        </div>
        <div className="ui-toaster__region" aria-live="assertive" aria-atomic="false">
          {assertive.map((i) => (
            <ToastView key={i.id} item={i} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
