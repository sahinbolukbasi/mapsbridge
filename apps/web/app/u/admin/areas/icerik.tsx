"use client";
// İçerik: yazılar ve rehberler (oluştur, düzenle, yayınla, arşivle).
import { useState } from "react";
import { Badge, Button } from "../../../components/ui";
import type { AdminRow } from "../../../lib/admin/types";
import { AreaFrame, Panel } from "../area-frame";
import { useConfirm } from "../confirm-action";
import { EditDialog } from "../edit-dialog";
import { formatDate, statusLabel } from "../format";
import { RecordTable } from "../record-table";
import { useAdminMutation, useAreaData } from "../use-area-data";

const typeOf = (r: AdminRow) =>
  String(r.type ?? (String(r.PK ?? "").startsWith("GUIDE#") ? "guide" : "blog"));
const idOf = (r: AdminRow) => String(r.id ?? String(r.PK ?? "").replace(/^(BLOG|GUIDE)#/, ""));
const bodyField = (r: AdminRow) => (typeOf(r) === "guide" ? "description" : "content");

export function IcerikArea() {
  const run = useAdminMutation();
  const [confirmNode, confirm] = useConfirm();
  const [editing, setEditing] = useState<AdminRow | "new" | null>(null);
  const { data, errors, loading, reload } = useAreaData(["content"] as const);
  const rows = data.content?.content ?? [];

  const update = (
    r: AdminRow,
    status: string,
    reason: string,
    extra: Record<string, unknown> = {},
  ) =>
    run(
      "content.update",
      {
        params: { type: typeOf(r), id: idOf(r) },
        body: {
          reason,
          status,
          title: r.title,
          [bodyField(r)]: r[bodyField(r)],
          version: r.version ?? 0,
          ...extra,
        },
      },
      { success: "İçerik güncellendi.", after: reload },
    );

  const editingRow = editing && editing !== "new" ? editing : null;

  return (
    <Panel
      title="Yazılar ve rehberler"
      actions={
        <Button size="sm" onClick={() => setEditing("new")}>
          Yeni yazı
        </Button>
      }
    >
      <AreaFrame
        level={3}
        loading={loading}
        error={errors.content}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{ title: "Henüz içerik yok.", description: "Yeni yazı ile ilk taslağı oluşturun." }}
      >
        <RecordTable
          caption="İçerikler"
          rows={rows}
          rowKey={(r) => `${typeOf(r)}-${idOf(r)}`}
          searchLabel="Başlık ara"
          searchText={(r) => String(r.title ?? "")}
          csvName="icerik"
          columns={[
            {
              key: "title",
              header: "Başlık",
              rowHeader: true,
              sortable: true,
              render: (r) => String(r.title ?? "—"),
            },
            {
              key: "type",
              header: "Tür",
              value: typeOf,
              render: (r) => (typeOf(r) === "guide" ? "Rehber" : "Yazı"),
            },
            {
              key: "status",
              header: "Durum",
              sortable: true,
              render: (r) => (
                <Badge
                  tone={
                    r.status === "published"
                      ? "success"
                      : r.status === "archived"
                        ? "neutral"
                        : "warning"
                  }
                >
                  {statusLabel(r.status)}
                </Badge>
              ),
            },
            {
              key: "createdAt",
              header: "Tarih",
              sortable: true,
              render: (r) => formatDate(r.createdAt),
            },
            {
              key: "actions",
              header: "İşlemler",
              render: (r) => (
                <div className="admin-row-actions">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                    Düzenle
                  </Button>
                  {r.status !== "published" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        confirm({
                          title: "İçerik yayınlansın mı?",
                          consequence: "İçerik herkese açık olarak yayımlanır.",
                          confirmLabel: "Yayınla",
                          tone: "primary",
                          run: async (reason) => void (await update(r, "published", reason)),
                        })
                      }
                    >
                      Yayınla
                    </Button>
                  )}
                  {r.status !== "archived" && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        confirm({
                          title: "İçerik arşivlensin mi?",
                          consequence: "İçerik yayından kalkar.",
                          confirmLabel: "Arşivle",
                          run: async (reason) => void (await update(r, "archived", reason)),
                        })
                      }
                    >
                      Arşivle
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </AreaFrame>
      {confirmNode}
      <EditDialog
        open={editing !== null}
        title={editingRow ? "İçeriği düzenle" : "Yeni yazı (taslak)"}
        fields={[
          { name: "title", label: "Başlık", required: true, maxLength: 200 },
          editingRow && typeOf(editingRow) === "guide"
            ? { name: "description", label: "Açıklama", type: "textarea", maxLength: 30000 }
            : {
                name: "content",
                label: "İçerik",
                type: "textarea",
                required: true,
                maxLength: 30000,
              },
        ]}
        initial={
          editingRow
            ? {
                title: editingRow.title,
                [bodyField(editingRow)]: editingRow[bodyField(editingRow)],
              }
            : {}
        }
        onClose={() => setEditing(null)}
        onSubmit={async (values, reason) => {
          if (editingRow)
            await update(editingRow, String(editingRow.status ?? "draft"), reason, values);
          else
            await run(
              "content.create",
              { body: { ...values, reason } },
              {
                success: "Taslak oluşturuldu.",
                after: reload,
              },
            );
        }}
      />
    </Panel>
  );
}
