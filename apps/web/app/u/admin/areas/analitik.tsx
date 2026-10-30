"use client";
// Analitik: cihazlar, AI konuları, topluluk, abonelikler (salt okunur).
import { Tabs } from "../../../components/ui";
import type { EndpointId } from "../../../lib/admin/endpoints";
import { AreaFrame, KpiGrid, Panel } from "../area-frame";
import { formatNumber, formatRate, formatTry } from "../format";
import { RecordTable } from "../record-table";
import { useAreaData } from "../use-area-data";

type Spec = {
  id: Extract<EndpointId, `analytics.${string}`>;
  field: string;
  kpis: Array<[key: string, label: string, format?: (v: unknown) => string]>;
  lists: Array<[key: string, label: string]>;
};

const COLUMN_LABELS: Record<string, string> = {
  date: "Tarih",
  mobile: "Mobil",
  web: "Web",
  tablet: "Tablet",
  topic: "Konu",
  destination: "Destinasyon",
  count: "Adet",
  requests: "İstek",
  posts: "Gönderi",
  id: "Kimlik",
  title: "Başlık",
  likes: "Beğeni",
  tier: "Plan",
};

const SPECS: Record<string, Spec> = {
  cihazlar: {
    id: "analytics.devices",
    field: "devices",
    kpis: [
      ["total", "Toplam oturum"],
      ["mobile", "Mobil"],
      ["web", "Web"],
      ["tablet", "Tablet"],
      ["mobilePercent", "Mobil oranı (%)"],
    ],
    lists: [["trend", "Günlük dağılım"]],
  },
  "ai-konulari": {
    id: "analytics.aiTopics",
    field: "aiAnalytics",
    kpis: [
      ["totalRequests", "Toplam istek"],
      ["totalCost", "Toplam maliyet (USD)"],
      ["avgCostPerRequest", "İstek başı maliyet (USD)"],
      ["periodDays", "Dönem (gün)"],
    ],
    lists: [
      ["topTopics", "Öne çıkan konular"],
      ["topDestinations", "Öne çıkan destinasyonlar"],
      ["dailyActivity", "Günlük etkinlik"],
    ],
  },
  topluluk: {
    id: "analytics.community",
    field: "community",
    kpis: [
      ["totalPosts", "Toplam gönderi"],
      ["postsLast24h", "Son 24 saat"],
      ["postsLast7d", "Son 7 gün"],
      ["totalLikes", "Beğeni"],
      ["totalComments", "Yorum"],
      ["engagementRate", "Etkileşim oranı", formatRate],
    ],
    lists: [
      ["topPosts", "Öne çıkan gönderiler"],
      ["dailyTrend", "Günlük eğilim"],
    ],
  },
  abonelikler: {
    id: "analytics.subscriptions",
    field: "subscriptions",
    kpis: [
      ["total", "Toplam"],
      ["active", "Etkin"],
      ["cancelled", "İptal"],
      ["newLast30d", "Son 30 gün yeni"],
      ["churnRate", "Kayıp oranı", formatRate],
      ["mrrTry", "Aylık gelir (MRR)", formatTry],
      ["conversionRate", "Dönüşüm oranı", formatRate],
    ],
    lists: [["planBreakdown", "Plan dağılımı"]],
  },
};

export function AnalitikArea() {
  return (
    <Tabs
      urlParam="sekme"
      label="Analitik bölümleri"
      items={[
        { id: "cihazlar", label: "Cihazlar", panel: <Analytics spec={SPECS.cihazlar} /> },
        {
          id: "ai-konulari",
          label: "AI konuları",
          panel: <Analytics spec={SPECS["ai-konulari"]} />,
        },
        { id: "topluluk", label: "Topluluk", panel: <Analytics spec={SPECS.topluluk} /> },
        { id: "abonelikler", label: "Abonelikler", panel: <Analytics spec={SPECS.abonelikler} /> },
      ]}
    />
  );
}

function Analytics({ spec }: { spec: Spec }) {
  const { data, errors, loading, reload } = useAreaData([spec.id] as const);
  const body = ((data[spec.id] as Record<string, unknown> | undefined)?.[spec.field] ??
    {}) as Record<string, unknown>;
  return (
    <AreaFrame loading={loading} error={errors[spec.id]} onRetry={reload}>
      <div className="admin-stack">
        <KpiGrid
          label="Göstergeler"
          items={spec.kpis.map(([k, label, fmt]) => ({
            label,
            value: (fmt ?? formatNumber)(body[k]),
          }))}
        />
        {spec.lists.map(([k, label]) => {
          const rows = Array.isArray(body[k]) ? (body[k] as Record<string, unknown>[]) : [];
          const cols = Object.keys(rows[0] ?? {});
          return (
            <Panel key={k} title={label}>
              {rows.length === 0 ? (
                <p className="admin-muted">Bu dönem için veri yok.</p>
              ) : (
                <RecordTable
                  caption={`${label} tablosu`}
                  rows={rows}
                  rowKey={(r) => JSON.stringify(r)}
                  csvName={`analitik-${k}`}
                  columns={cols.map((c, i) => ({
                    key: c,
                    header: COLUMN_LABELS[c] ?? c,
                    rowHeader: i === 0,
                    sortable: true,
                    align: typeof rows[0][c] === "number" ? ("end" as const) : undefined,
                    render: (r: Record<string, unknown>) =>
                      typeof r[c] === "number" ? formatNumber(r[c]) : String(r[c] ?? "—"),
                  }))}
                />
              )}
            </Panel>
          );
        })}
      </div>
    </AreaFrame>
  );
}
