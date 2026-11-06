"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { prefersReducedMotion } from "../../lib/a11y/use-reduced-motion";
import { useLocale } from "../../lib/locale-context";
import { cx } from "./cx";
import { IconButton } from "./icon-button";
import {
  pauseTimer,
  resumeTimer,
  startTimer,
  toastDuration,
  type ToastTimer,
} from "./logic/toast-timing";
import { admitToast, isModalOpen, releaseHeld } from "./logic/toast-hold";
import { Icon, type IconName } from "./svg-icon";
import "./ui.css";

export type ToastTone = "info" | "success" | "warning" | "danger";
type ToastAction = { label: string; onClick: () => void };
/**
 * Toast (direction §3): ton başına sol şerit + ikonlu daire, isteğe bağlı başlık, gövde, eylem
 * ("Geri al", "Tekrar dene") ve süre çubuğu. Hata (danger) ve eylemli toast kendiliğinden kapanmaz
 * (WCAG 2.2.1); aynı eylem sayfada kalıcı bir yerde de bulunmalıdır: `actionAlsoAt` bunu belgeler.
 * Süre üzerine gelince / odakta durur (logic/toast-timing.ts).
 */
export type ToastInput =
  | { tone?: ToastTone; title?: string; message: string; durationMs?: number; action?: undefined }
  | {
      tone?: ToastTone;
      title?: string;
      message: string;
      action: ToastAction;
      actionAlsoAt: string;
    };
type ToastItem = {
  id: number;
  tone: ToastTone;
  title?: string;
  message: string;
  action?: ToastAction;
  /** null: süresiz */
  duration: number | null;
  leaving?: boolean;
};

type ToastApi = { show: (t: ToastInput) => number; dismiss: (id: number) => void };
const ToastContext = createContext<ToastApi | null>(null);
const TONE_ICON: Record<ToastTone, IconName> = {
  info: "info",
  success: "check",
  warning: "alert",
  danger: "error",
};

/** Toaster yoksa (C6 öncesi) çağrılar sessizce yok sayılır. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { show: () => -1, dismiss: () => undefined };
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const { t } = useLocale();
  const [paused, setPaused] = useState(false);
  const timer = useRef<ToastTimer | null>(
    item.duration === null ? null : startTimer(item.duration, Date.now()),
  );
  useEffect(() => {
    const current = timer.current;
    if (!current || item.leaving) return;
    if (paused) {
      timer.current = pauseTimer(current, Date.now());
      return;
    }
    timer.current = resumeTimer(current, Date.now());
    const handle = window.setTimeout(() => onDismiss(item.id), timer.current.remaining);
    return () => window.clearTimeout(handle);
  }, [item.id, item.leaving, paused, onDismiss]);
  const style =
    item.duration === null
      ? undefined
      : ({ "--toast-duration": `${item.duration}ms` } as CSSProperties);
  return (
    <div
      className={cx("ui-toast", `ui-toast--${item.tone}`, item.leaving && "ui-toast--leaving")}
      data-surface="default"
      data-paused={paused || undefined}
      style={style}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDismiss(item.id);
      }}
    >
      <span className="ui-toast__icon" aria-hidden="true">
        <Icon name={TONE_ICON[item.tone]} size={16} />
      </span>
      <div className="ui-toast__body">
        {item.title && <p className="ui-toast__title">{item.title}</p>}
        <p className="ui-toast__message">{item.message}</p>
      </div>
      {item.action && (
        <button
          type="button"
          className="ui-button ui-button--link ui-button--sm ui-toast__action"
          onClick={() => {
            item.action?.onClick();
            onDismiss(item.id);
          }}
        >
          <span className="ui-button__label">{item.action.label}</span>
        </button>
      )}
      <IconButton
        icon="x"
        label={t("ui.close", "Kapat")}
        size="sm"
        onClick={() => onDismiss(item.id)}
      />
      {item.duration !== null && <span className="ui-toast__timer" aria-hidden="true" />}
    </div>
  );
}

/** Çıkış animasyonu süresi (--duration-base) + pay; azaltılmış harekette anında. */
function leaveMs(): number {
  if (prefersReducedMotion()) return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--duration-base");
  const ms = parseFloat(raw);
  return (Number.isFinite(ms) ? ms : 200) + 40;
}

function modalOpenNow(): boolean {
  return typeof document !== "undefined" && isModalOpen((s) => document.querySelector(s));
}
/**
 * SiteChrome'da tek örnek (C6). Kalıcı canlı bölgeler sayfa yüklenirken DOM'dadır: bilgi/başarı/
 * uyarı polite; hata role="alert" (assertive). Konum: masaüstü sağ üst, mobil alt menünün üstü.
 * Modal (showModal) açıkken gelen toast bekletilir ve son modal kapanınca gösterilir; aksi halde
 * inert arka planda görünmez ve duyurulmaz kalırdı (logic/toast-hold.ts, review-foundation B2).
 */
export function Toaster({ children }: { children?: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [held, setHeld] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => {
    setHeld((list) => list.filter((i) => i.id !== id));
    setItems((list) => list.map((i) => (i.id === id ? { ...i, leaving: true } : i)));
    window.setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), leaveMs());
  }, []);
  const show = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    const tone = input.tone ?? "info";
    const item: ToastItem = {
      id,
      tone,
      title: input.title,
      message: input.message,
      action: input.action,
      duration: toastDuration({
        tone,
        hasAction: Boolean(input.action),
        durationMs: input.action ? undefined : input.durationMs,
      }),
    };
    if (admitToast(modalOpenNow()) === "hold") setHeld((list) => [...list, item]);
    else setItems((list) => [...list, item]);
    return id;
  }, []);
  // Bekleyen varken dialog açık/kapalı ve ekleme/çıkarma değişimleri izlenir; modal kalmayınca
  // bekleyenler canlı bölgelere eklenir (o an duyurulur, süre o an başlar).
  useEffect(() => {
    if (held.length === 0) return;
    const flush = () => {
      const { show: ready } = releaseHeld(held, modalOpenNow());
      if (ready.length === 0) return;
      setHeld([]);
      setItems((list) => [...list, ...ready]);
    };
    flush();
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(flush);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    return () => observer.disconnect();
  }, [held]);
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
        <div className="ui-toaster__region" role="alert" aria-live="assertive" aria-atomic="false">
          {assertive.map((i) => (
            <ToastView key={i.id} item={i} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
