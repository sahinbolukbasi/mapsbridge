"use client";
// Alan şablonu durumları (design §8.4): yükleniyor → LoadingState + Skeleton; hata → ErrorState
// (§8.5 metni) + Tekrar dene/Yenile; boş → EmptyState; aksi halde içerik.
import { useId, type ReactNode } from "react";
import { EmptyState, ErrorState, LoadingState, Skeleton } from "../../components/ui";
import type { UiError } from "../../components/ui/logic/http-error";

export function AreaFrame({
  loading,
  error,
  isEmpty = false,
  empty,
  onRetry,
  level = 2,
  children,
}: {
  loading: boolean;
  error?: UiError | null;
  isEmpty?: boolean;
  empty?: { title: string; description?: ReactNode; action?: ReactNode };
  onRetry: () => void;
  /** Boş durum başlık seviyesi: Panel (h2) içinde 3, doğrudan sekme panelinde 2. */
  level?: 2 | 3;
  children: ReactNode;
}) {
  if (loading)
    return (
      <LoadingState
        label="Veriler yükleniyor…"
        skeleton={
          <div className="admin-skeleton" aria-hidden="true">
            <Skeleton shape="rect" height="2.5rem" />
            <Skeleton lines={4} />
          </div>
        }
      />
    );
  if (error) return <ErrorState error={error} onRetry={onRetry} onRefresh={onRetry} />;
  if (isEmpty && empty)
    return (
      <EmptyState
        icon="inbox"
        title={empty.title}
        description={empty.description}
        action={empty.action}
        level={level}
      />
    );
  return <>{children}</>;
}

export type KpiItem = { label: string; value: ReactNode; hint?: ReactNode };

/** KPI kartları (<dl>): etiket dt, değer dd. */
export function KpiGrid({ items, label }: { items: KpiItem[]; label: string }) {
  return (
    <dl className="admin-kpis" aria-label={label}>
      {items.map((item) => (
        <div key={item.label} className="admin-kpi">
          <dt className="admin-kpi__label">{item.label}</dt>
          <dd className="admin-kpi__value">{item.value}</dd>
          {item.hint && <dd className="admin-kpi__hint">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Anahtar–değer ayrıntı listesi. */
export function DetailList({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="admin-details">
      {items.map(([k, v]) => (
        <div key={k} className="admin-details__row">
          <dt>{k}</dt>
          <dd>{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Alt bölüm: <section aria-labelledby> + h2 başlık + aksiyon çubuğu (sayfa h1'i PageHeader'da). */
export function Panel({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="admin-panel" aria-labelledby={id}>
      <div className="admin-panel__header">
        <h2 id={id} className="admin-panel__title">
          {title}
        </h2>
        {actions && <div className="admin-panel__actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
