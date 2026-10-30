"use client";
// Sistem: bakım ve özellikler, modüller, duyurular, sağlık. Bakım modunu açmak yazılı "BAKIM"
// onayı ister; modül kapatma ve duyuru yayınlama ConfirmDialog'dan geçer.
import { useState } from "react";
import { Badge, Button, Tabs } from "../../../components/ui";
import type { AdminModuleConfig, AdminRow } from "../../../lib/admin/types";
import { AreaFrame, DetailList, Panel } from "../area-frame";
import { useConfirm } from "../confirm-action";
import { EditDialog } from "../edit-dialog";
import { formatDate, statusLabel } from "../format";
import { RecordTable } from "../record-table";
import { useAdminMutation, useAreaData } from "../use-area-data";
import { healthTone } from "./genel";

export function SistemArea() {
  return (
    <Tabs
      urlParam="sekme"
      label="Sistem bölümleri"
      items={[
        { id: "bakim", label: "Bakım ve özellikler", panel: <Maintenance /> },
        { id: "moduller", label: "Modüller", panel: <Modules /> },
        { id: "duyurular", label: "Duyurular", panel: <Announcements /> },
        { id: "saglik", label: "Sağlık", panel: <Health /> },
      ]}
    />
  );
}

const onOff = (v: unknown) =>
  v === false ? <Badge tone="neutral">Kapalı</Badge> : <Badge tone="success">Açık</Badge>;

function Maintenance() {
  const run = useAdminMutation();
  const [confirmNode, confirm] = useConfirm();
  const [editing, setEditing] = useState(false);
  const { data, errors, loading, reload } = useAreaData(["systemConfig"] as const);
  const c = data.systemConfig?.config;
  const save = (body: Record<string, unknown>, reason: string, success: string) =>
    run(
      "systemConfig.update",
      {
        body: {
          maintenanceMode: c?.maintenanceMode ?? false,
          ...body,
          reason,
          version: c?.version,
        },
      },
      { success, after: reload },
    );
  return (
    <AreaFrame loading={loading} error={errors.systemConfig} onRetry={reload}>
      <Panel
        title="Bakım modu"
        actions={
          c?.maintenanceMode ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                confirm({
                  title: "Bakım modu kapatılsın mı?",
                  consequence: "Uygulama yeniden herkese açılır.",
                  confirmLabel: "Bakımı kapat",
                  tone: "primary",
                  run: async (reason) =>
                    void (await save({ maintenanceMode: false }, reason, "Bakım modu kapatıldı.")),
                })
              }
            >
              Bakımı kapat
            </Button>
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={() =>
                confirm({
                  title: "Bakım modu açılsın mı?",
                  consequence:
                    "Tüm kullanıcılar bakım ekranı görür; rota ve paylaşım işlemleri durur.",
                  confirmLabel: "Bakımı aç",
                  typed: "BAKIM",
                  run: async (reason) =>
                    void (await save({ maintenanceMode: true }, reason, "Bakım modu açıldı.")),
                })
              }
            >
              Bakımı aç
            </Button>
          )
        }
      >
        <DetailList
          items={[
            [
              "Bakım modu",
              c?.maintenanceMode ? (
                <Badge tone="danger">Açık</Badge>
              ) : (
                <Badge tone="success">Kapalı</Badge>
              ),
            ],
            ["Bakım mesajı", c?.maintenanceMessage],
            ["Rota oluşturma", onOff(c?.routeCreationEnabled)],
            ["Konum paylaşımı", onOff(c?.sharesEnabled)],
            ["Son güncelleme", formatDate(c?.updatedAt)],
          ]}
        />
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          Özellikleri düzenle
        </Button>
      </Panel>
      {confirmNode}
      <EditDialog
        open={editing}
        title="Özellik bayrakları"
        fields={[
          { name: "routeCreationEnabled", label: "Rota oluşturma", type: "checkbox" },
          { name: "sharesEnabled", label: "Konum paylaşımı", type: "checkbox" },
          { name: "maintenanceMessage", label: "Bakım mesajı", type: "textarea", maxLength: 500 },
        ]}
        initial={{
          routeCreationEnabled: c?.routeCreationEnabled !== false,
          sharesEnabled: c?.sharesEnabled !== false,
          maintenanceMessage: c?.maintenanceMessage,
        }}
        onClose={() => setEditing(false)}
        onSubmit={async (values, reason) =>
          void (await save(values, reason, "Özellikler güncellendi."))
        }
      />
    </AreaFrame>
  );
}

const MODULES: Array<[keyof AdminModuleConfig, string]> = [
  ["mapEnabled", "Harita"],
  ["aiEnabled", "AI asistan"],
  ["communityEnabled", "Topluluk"],
  ["messagingEnabled", "Mesajlaşma"],
];

function Modules() {
  const run = useAdminMutation();
  const [confirmNode, confirm] = useConfirm();
  const { data, errors, loading, reload } = useAreaData(["moduleConfig"] as const);
  const mc = data.moduleConfig?.moduleConfig;
  const rows = MODULES.map(([key, label]) => ({ key, label, enabled: mc?.[key] !== false }));
  return (
    <AreaFrame loading={loading} error={errors.moduleConfig} onRetry={reload}>
      <RecordTable
        caption="Modüller"
        rows={rows}
        rowKey={(r) => r.key}
        columns={[
          { key: "label", header: "Modül", rowHeader: true },
          { key: "enabled", header: "Durum", render: (r) => onOff(r.enabled) },
          {
            key: "actions",
            header: "İşlemler",
            render: (r) => (
              <Button
                variant={r.enabled ? "danger" : "secondary"}
                size="sm"
                onClick={() =>
                  confirm({
                    title: r.enabled ? `${r.label} kapatılsın mı?` : `${r.label} açılsın mı?`,
                    consequence: r.enabled
                      ? "Modül tüm kullanıcılar için hemen devre dışı kalır."
                      : "Modül tüm kullanıcılar için yeniden etkinleşir.",
                    confirmLabel: r.enabled ? "Kapat" : "Aç",
                    tone: r.enabled ? "danger" : "primary",
                    run: async (reason) => {
                      await run(
                        "moduleConfig.update",
                        { body: { [r.key]: !r.enabled, reason } },
                        {
                          success: "Modül güncellendi.",
                          after: reload,
                        },
                      );
                    },
                  })
                }
              >
                {r.enabled ? "Kapat" : "Aç"}
              </Button>
            ),
          },
        ]}
      />
      {confirmNode}
    </AreaFrame>
  );
}

function Announcements() {
  const run = useAdminMutation();
  const [confirmNode, confirm] = useConfirm();
  const [editing, setEditing] = useState<AdminRow | "new" | null>(null);
  const { data, errors, loading, reload } = useAreaData(["announcements"] as const);
  const rows = data.announcements?.announcements ?? [];
  const row = editing && editing !== "new" ? editing : null;
  const save = (values: Record<string, unknown>, reason: string, base: AdminRow | null) =>
    run(
      "announcements.save",
      {
        body: {
          ...(base
            ? {
                id: base.id,
                version: base.version,
                title: base.title,
                message: base.message,
                status: base.status,
                startsAt: base.startsAt,
                endsAt: base.endsAt,
              }
            : {}),
          ...values,
          reason,
        },
      },
      { success: "Duyuru kaydedildi.", after: reload },
    );
  return (
    <Panel
      title="Duyurular"
      actions={
        <Button size="sm" onClick={() => setEditing("new")}>
          Yeni duyuru
        </Button>
      }
    >
      <AreaFrame
        level={3}
        loading={loading}
        error={errors.announcements}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{ title: "Henüz duyuru yok." }}
      >
        <RecordTable
          caption="Duyurular"
          rows={rows}
          rowKey={(r) => String(r.id)}
          csvName="duyurular"
          columns={[
            {
              key: "title",
              header: "Başlık",
              rowHeader: true,
              render: (r) => String(r.title ?? "—"),
            },
            { key: "status", header: "Durum", render: (r) => statusLabel(r.status) },
            { key: "startsAt", header: "Başlangıç", render: (r) => formatDate(r.startsAt) },
            { key: "endsAt", header: "Bitiş", render: (r) => formatDate(r.endsAt) },
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
                          title: "Duyuru yayınlansın mı?",
                          consequence: "Duyuru tüm kullanıcılara gösterilir.",
                          confirmLabel: "Yayınla",
                          tone: "primary",
                          run: async (reason) =>
                            void (await save({ status: "published" }, reason, r)),
                        })
                      }
                    >
                      Yayınla
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
        title={row ? "Duyuruyu düzenle" : "Yeni duyuru"}
        fields={[
          { name: "title", label: "Başlık", required: true, maxLength: 160 },
          { name: "message", label: "Mesaj", type: "textarea", required: true, maxLength: 1500 },
          {
            name: "status",
            label: "Durum",
            type: "select",
            required: true,
            options: ["draft", "archived"].map((s) => ({ value: s, label: statusLabel(s) })),
            hint: "Yayınlamak için listedeki Yayınla düğmesini kullanın.",
          },
          { name: "startsAt", label: "Başlangıç", type: "datetime" },
          { name: "endsAt", label: "Bitiş", type: "datetime" },
        ]}
        initial={{
          title: row?.title,
          message: row?.message,
          status: row?.status === "archived" ? "archived" : "draft",
          startsAt: typeof row?.startsAt === "string" ? row.startsAt.slice(0, 16) : "",
          endsAt: typeof row?.endsAt === "string" ? row.endsAt.slice(0, 16) : "",
        }}
        onClose={() => setEditing(null)}
        onSubmit={async (values, reason) => {
          if (values.startsAt && values.endsAt && String(values.endsAt) <= String(values.startsAt))
            throw new Error("Bitiş zamanı başlangıçtan sonra olmalı.");
          await save(values, reason, row);
        }}
      />
    </Panel>
  );
}

function Health() {
  const { data, errors, loading, reload } = useAreaData(["systemHealth"] as const);
  const h = data.systemHealth?.health;
  const rows = Object.entries(h?.services ?? {}).map(([name, svc]) => ({ name, ...svc }));
  return (
    <AreaFrame loading={loading} error={errors.systemHealth} onRetry={reload}>
      <Panel
        title="Servisler"
        actions={
          h && (
            <Badge tone={healthTone(h.status)} dot>
              {statusLabel(h.status)}
            </Badge>
          )
        }
      >
        <RecordTable
          caption="Servis sağlığı"
          rows={rows}
          rowKey={(r) => r.name}
          csvName="servis-sagligi"
          columns={[
            { key: "name", header: "Servis", rowHeader: true },
            {
              key: "status",
              header: "Durum",
              render: (r) => <Badge tone={healthTone(r.status)}>{statusLabel(r.status)}</Badge>,
            },
            {
              key: "latencyMs",
              header: "Gecikme (ms)",
              align: "end",
              sortable: true,
              render: (r) => (typeof r.latencyMs === "number" ? String(r.latencyMs) : "—"),
            },
          ]}
        />
      </Panel>
    </AreaFrame>
  );
}
