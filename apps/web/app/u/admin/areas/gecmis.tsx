"use client";
// İşlem geçmişi (audit-logs, salt okunur).
import { AreaFrame, Panel } from "../area-frame";
import { formatDate } from "../format";
import { RecordTable } from "../record-table";
import { useAreaData } from "../use-area-data";

export function GecmisArea() {
  const { data, errors, loading, reload } = useAreaData(["auditLogs"] as const, {
    auditLogs: { query: { limit: 100 } },
  });
  const rows = data.auditLogs?.logs ?? [];
  return (
    <Panel title="Yönetim işlemleri">
      <AreaFrame
        level={3}
        loading={loading}
        error={errors.auditLogs}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{ title: "Henüz kayıtlı işlem yok." }}
      >
        <RecordTable
          caption="İşlem geçmişi"
          rows={rows}
          rowKey={(r) => r.auditId}
          searchLabel="İşlem, hedef veya gerekçe ara"
          searchText={(r) => `${r.action} ${r.targetId} ${r.reason} ${r.actorSub}`}
          csvName="islem-gecmisi"
          columns={[
            {
              key: "createdAt",
              header: "Tarih",
              sortable: true,
              rowHeader: true,
              render: (r) => formatDate(r.createdAt),
            },
            { key: "action", header: "İşlem", sortable: true },
            { key: "targetId", header: "Hedef" },
            { key: "actorSub", header: "Yapan" },
            { key: "reason", header: "Gerekçe" },
          ]}
        />
      </AreaFrame>
    </Panel>
  );
}
