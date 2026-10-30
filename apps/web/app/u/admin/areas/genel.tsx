"use client";
// Genel bakış: KPI (metrics), canlı telemetri (realtime) ve sistem sağlığı özeti.
import { Badge } from "../../../components/ui";
import { canRun } from "../../../lib/admin/rbac";
import { AreaFrame, KpiGrid, Panel } from "../area-frame";
import { formatDate, formatNumber, orPending, statusLabel } from "../format";
import { useAdmin, useAreaData } from "../use-area-data";

export function healthTone(status: unknown) {
  return status === "operational" ? "success" : status === "degraded" ? "warning" : "danger";
}

export function GenelArea() {
  const { session } = useAdmin();
  const { data, errors, loading, reload } = useAreaData([
    "metrics",
    "realtime",
    "systemHealth",
  ] as const);
  const m = data.metrics?.metrics;
  const rt = data.realtime?.realtime;
  const health = data.systemHealth?.health;
  const telemetry = (rt?.telemetry ?? {}) as Record<string, unknown>;

  return (
    <div className="admin-stack">
      <Panel title="Temel göstergeler">
        <AreaFrame loading={loading} error={errors.metrics} onRetry={reload}>
          <KpiGrid
            label="Temel göstergeler"
            items={[
              { label: "Toplam kullanıcı", value: formatNumber(m?.totalUsers) },
              { label: "Etkin abonelik", value: formatNumber(m?.activeSubscriptions) },
              { label: "Rehber", value: formatNumber(m?.totalGuides) },
              { label: "Bugünkü ödeme", value: formatNumber(m?.todayPayments) },
            ]}
          />
        </AreaFrame>
      </Panel>
      {canRun(session, "realtime") && (
        <Panel title="Canlı">
          <AreaFrame loading={loading} error={errors.realtime} onRetry={reload}>
            <KpiGrid
              label="Canlı göstergeler"
              items={[
                { label: "Kayıtlı kullanıcı", value: orPending(rt?.registeredUsers) },
                { label: "Etkin gezgin", value: orPending(rt?.activeExplorers) },
                ...Object.entries(telemetry).map(([k, v]) => ({ label: k, value: orPending(v) })),
              ]}
            />
            {typeof rt?.note === "string" && <p className="admin-muted">{rt.note}</p>}
          </AreaFrame>
        </Panel>
      )}
      {canRun(session, "systemHealth") && (
        <Panel
          title="Sistem sağlığı"
          actions={
            health && (
              <Badge tone={healthTone(health.status)} dot>
                {statusLabel(health.status)}
              </Badge>
            )
          }
        >
          <AreaFrame loading={loading} error={errors.systemHealth} onRetry={reload}>
            <p className="admin-muted">
              {health?.environment} · {health?.region} · {formatDate(health?.timestamp)}
            </p>
            <ul className="admin-chips" aria-label="Servis durumları">
              {Object.entries(health?.services ?? {}).map(([name, svc]) => (
                <li key={name}>
                  <Badge tone={healthTone(svc.status)}>
                    {name}: {statusLabel(svc.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          </AreaFrame>
        </Panel>
      )}
    </div>
  );
}
