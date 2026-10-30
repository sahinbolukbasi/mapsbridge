"use client";
// Finans: özet, ödemeler (iade), abonelikler (iptal/sürdür). Para tutarları TRY.
import { Badge, Button, Tabs } from "../../../components/ui";
import { mapPayments, mapSubscriptions } from "../../../lib/admin/mappers";
import { AreaFrame, KpiGrid, Panel } from "../area-frame";
import { useConfirm } from "../confirm-action";
import { formatDate, formatNumber, formatTry, statusLabel } from "../format";
import { RecordTable } from "../record-table";
import { useAdminMutation, useAreaData } from "../use-area-data";

export function FinansArea() {
  return (
    <Tabs
      urlParam="sekme"
      label="Finans bölümleri"
      items={[
        { id: "ozet", label: "Özet", panel: <Summary /> },
        { id: "odemeler", label: "Ödemeler", panel: <Payments /> },
        { id: "abonelikler", label: "Abonelikler", panel: <Subscriptions /> },
      ]}
    />
  );
}

function Summary() {
  const { data, errors, loading, reload } = useAreaData(["finance"] as const);
  const f = data.finance?.finance;
  const months = f?.monthlyRevenue ?? [];
  return (
    <AreaFrame loading={loading} error={errors.finance} onRetry={reload}>
      <div className="admin-stack">
        <KpiGrid
          label="Finans özeti"
          items={[
            { label: "Toplam gelir", value: formatTry(f?.totalRevenueTRY) },
            { label: "İşlem", value: formatNumber(f?.totalTransactions) },
            { label: "Başarısız işlem", value: formatNumber(f?.failedTransactions) },
          ]}
        />
        <Panel title="Aylık gelir">
          <RecordTable
            caption="Aylık gelir tablosu"
            rows={months}
            rowKey={(m) => m.month}
            csvName="aylik-gelir"
            columns={[
              { key: "month", header: "Ay", rowHeader: true, sortable: true },
              {
                key: "amount",
                header: "Tutar",
                align: "end",
                sortable: true,
                render: (m) => formatTry(m.amount),
              },
            ]}
          />
        </Panel>
      </div>
    </AreaFrame>
  );
}

function Payments() {
  const run = useAdminMutation();
  const [confirmNode, confirm] = useConfirm();
  const { data, errors, loading, reload } = useAreaData(["payments"] as const);
  const rows = data.payments ? mapPayments(data.payments) : [];
  return (
    <AreaFrame
      loading={loading}
      error={errors.payments}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{ title: "Henüz ödeme yok." }}
    >
      <RecordTable
        caption="Ödemeler"
        rows={rows}
        rowKey={(p) => p.id}
        searchLabel="Ödeme veya kullanıcı ara"
        searchText={(p) => `${p.id} ${p.userId} ${p.packId}`}
        csvName="odemeler"
        columns={[
          { key: "id", header: "Ödeme", rowHeader: true },
          { key: "userId", header: "Kullanıcı" },
          {
            key: "amountTry",
            header: "Tutar",
            align: "end",
            sortable: true,
            render: (p) => formatTry(p.amountTry),
          },
          {
            key: "status",
            header: "Durum",
            sortable: true,
            render: (p) => (
              <Badge
                tone={
                  p.status === "succeeded"
                    ? "success"
                    : p.status === "refunded"
                      ? "neutral"
                      : "warning"
                }
              >
                {statusLabel(p.status)}
              </Badge>
            ),
          },
          {
            key: "createdAt",
            header: "Tarih",
            sortable: true,
            render: (p) => formatDate(p.createdAt),
          },
          {
            key: "actions",
            header: "İşlemler",
            render: (p) =>
              p.refundable ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    confirm({
                      title: `${formatTry(p.amountTry)} iade edilsin mi?`,
                      consequence:
                        "Tutar Stripe üzerinden kullanıcıya iade edilir. Bu işlem geri alınamaz.",
                      confirmLabel: "İade et",
                      run: async (reason) => {
                        await run(
                          "users.refund",
                          {
                            params: { id: p.userId },
                            body: { paymentIntentId: p.paymentIntentId, reason },
                          },
                          { success: "İade başlatıldı.", after: reload },
                        );
                      },
                    })
                  }
                >
                  İade et
                </Button>
              ) : null,
          },
        ]}
      />
      {confirmNode}
    </AreaFrame>
  );
}

function Subscriptions() {
  const run = useAdminMutation();
  const [confirmNode, confirm] = useConfirm();
  const { data, errors, loading, reload } = useAreaData(["subscriptions"] as const);
  const rows = data.subscriptions ? mapSubscriptions(data.subscriptions) : [];
  return (
    <AreaFrame
      loading={loading}
      error={errors.subscriptions}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{ title: "Henüz abonelik yok." }}
    >
      <RecordTable
        caption="Abonelikler"
        rows={rows}
        rowKey={(s) => s.userId}
        searchLabel="Kullanıcı ara"
        searchText={(s) => `${s.userId} ${s.tier}`}
        csvName="abonelikler"
        columns={[
          { key: "userId", header: "Kullanıcı", rowHeader: true },
          { key: "tier", header: "Plan", sortable: true },
          { key: "status", header: "Durum", sortable: true, render: (s) => statusLabel(s.status) },
          {
            key: "cancelAtPeriodEnd",
            header: "Dönem sonunda bitiyor",
            value: (s) => (s.cancelAtPeriodEnd ? "Evet" : "Hayır"),
            render: (s) => (s.cancelAtPeriodEnd ? "Evet" : "Hayır"),
          },
          {
            key: "actions",
            header: "İşlemler",
            render: (s) => {
              const cancel = !s.cancelAtPeriodEnd && s.status === "active";
              return (
                <Button
                  variant={cancel ? "danger" : "secondary"}
                  size="sm"
                  onClick={() =>
                    confirm({
                      title: cancel ? "Abonelik iptal edilsin mi?" : "Abonelik sürdürülsün mü?",
                      consequence: cancel
                        ? "Abonelik dönem sonunda sona erer."
                        : "Abonelik yenilenmeye devam eder.",
                      confirmLabel: cancel ? "İptal et" : "Sürdür",
                      tone: cancel ? "danger" : "primary",
                      run: async (reason) => {
                        await run(
                          "users.subscription",
                          {
                            params: { id: s.userId },
                            body: { reason, action: cancel ? "cancel" : "resume" },
                          },
                          { success: "Abonelik güncellendi.", after: reload },
                        );
                      },
                    })
                  }
                >
                  {cancel ? "İptal et" : "Sürdür"}
                </Button>
              );
            },
          },
        ]}
      />
      {confirmNode}
    </AreaFrame>
  );
}
