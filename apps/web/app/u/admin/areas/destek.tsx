"use client";
// Destek: talepler (yanıtla, durum/öncelik, iç not, üstlen). Sürüm uyuşmazlığı 409 → dialog açık.
import { useState } from "react";
import { Badge, Button } from "../../../components/ui";
import { mapTickets, type TicketView } from "../../../lib/admin/mappers";
import { AreaFrame, Panel } from "../area-frame";
import { EditDialog } from "../edit-dialog";
import { formatDate, statusLabel } from "../format";
import { RecordTable } from "../record-table";
import { useAdminMutation, useAreaData } from "../use-area-data";

const PRIORITY: Record<string, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};
const STATUSES = ["open", "in_progress", "resolved", "closed"];

export function DestekArea() {
  const run = useAdminMutation();
  const [ticket, setTicket] = useState<TicketView | null>(null);
  const { data, errors, loading, reload } = useAreaData(["tickets"] as const);
  const rows = data.tickets ? mapTickets(data.tickets) : [];
  const last = (t: TicketView) => {
    const m = t.messages[t.messages.length - 1];
    return m ? String(m.text ?? "") : "";
  };

  return (
    <Panel title="Talepler">
      <AreaFrame
        level={3}
        loading={loading}
        error={errors.tickets}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{ title: "Henüz destek talebi yok." }}
      >
        <RecordTable
          caption="Destek talepleri"
          rows={rows}
          rowKey={(t) => t.id}
          searchLabel="Talep ara"
          searchText={(t) => `${t.subject} ${t.id}`}
          csvName="talepler"
          columns={[
            { key: "subject", header: "Konu", rowHeader: true, sortable: true },
            {
              key: "status",
              header: "Durum",
              sortable: true,
              render: (t) => (
                <Badge
                  tone={
                    t.status === "open"
                      ? "warning"
                      : t.status === "in_progress"
                        ? "info"
                        : "neutral"
                  }
                >
                  {statusLabel(t.status)}
                </Badge>
              ),
            },
            {
              key: "priority",
              header: "Öncelik",
              sortable: true,
              render: (t) => (
                <Badge
                  tone={t.priority === "urgent" || t.priority === "high" ? "danger" : "neutral"}
                >
                  {PRIORITY[t.priority] ?? t.priority}
                </Badge>
              ),
            },
            {
              key: "updatedAt",
              header: "Güncelleme",
              sortable: true,
              render: (t) => formatDate(t.updatedAt ?? t.createdAt),
            },
            {
              key: "actions",
              header: "İşlemler",
              render: (t) => (
                <Button variant="secondary" size="sm" onClick={() => setTicket(t)}>
                  Yanıtla
                </Button>
              ),
            },
          ]}
        />
      </AreaFrame>
      <EditDialog
        open={ticket !== null}
        title={ticket ? `Talep: ${ticket.subject}` : "Talep"}
        description={ticket && last(ticket) ? `Son mesaj: ${last(ticket)}` : undefined}
        size="lg"
        fields={[
          {
            name: "status",
            label: "Durum",
            type: "select",
            required: true,
            options: STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
          },
          {
            name: "priority",
            label: "Öncelik",
            type: "select",
            required: true,
            options: Object.entries(PRIORITY).map(([value, label]) => ({ value, label })),
          },
          {
            name: "reply",
            label: "Yanıt",
            type: "textarea",
            maxLength: 4000,
            hint: "Kullanıcıya gönderilir.",
          },
          {
            name: "internalNote",
            label: "İç not",
            type: "textarea",
            maxLength: 4000,
            hint: "Yalnızca ekip görür.",
          },
          { name: "assignToMe", label: "Talebi üstlen", type: "checkbox" },
        ]}
        initial={{
          status: ticket?.status,
          priority: ticket?.priority,
          internalNote: ticket?.internalNote,
          assignToMe: false,
        }}
        submitLabel="Kaydet"
        onClose={() => setTicket(null)}
        onSubmit={async (values, reason) => {
          if (!ticket) return;
          await run(
            "tickets.update",
            { params: { id: ticket.id }, body: { ...values, reason, version: ticket.version } },
            { success: "Talep güncellendi.", after: reload },
          );
        }}
      />
    </Panel>
  );
}
