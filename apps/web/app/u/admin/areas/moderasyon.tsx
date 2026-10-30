"use client";
// Moderasyon: şikâyetler, rotalar, konum paylaşımları, profiller (Tabs ?sekme=).
import { Badge, Button, Tabs } from "../../../components/ui";
import { mapShares } from "../../../lib/admin/mappers";
import type { AdminReport, AdminRow } from "../../../lib/admin/types";
import { useState } from "react";
import { AreaFrame } from "../area-frame";
import { useConfirm } from "../confirm-action";
import { EditDialog } from "../edit-dialog";
import { formatDate, statusLabel } from "../format";
import { RecordTable } from "../record-table";
import { useAdminMutation, useAreaData } from "../use-area-data";

export function ModerasyonArea() {
  return (
    <Tabs
      urlParam="sekme"
      label="Moderasyon bölümleri"
      items={[
        { id: "sikayetler", label: "Şikâyetler", panel: <Reports /> },
        { id: "rotalar", label: "Rotalar", panel: <Routes /> },
        { id: "paylasimlar", label: "Konum paylaşımları", panel: <Shares /> },
        { id: "profiller", label: "Profiller", panel: <Profiles /> },
      ]}
    />
  );
}

const statusBadge = (status: unknown) => (
  <Badge
    tone={
      status === "pending"
        ? "warning"
        : status === "suspended" || status === "revoked"
          ? "danger"
          : status === "active" || status === "approved" || status === "featured"
            ? "success"
            : "neutral"
    }
  >
    {statusLabel(status)}
  </Badge>
);

function Reports() {
  const run = useAdminMutation();
  const [confirmNode, confirm] = useConfirm();
  const { data, errors, loading, reload } = useAreaData(["reports"] as const, {
    reports: { query: { limit: 100 } },
  });
  const rows = data.reports?.reports ?? [];
  const resolve = (r: AdminReport, action: "dismiss" | "hide_content" | "suspend_user") => {
    const text = {
      dismiss: ["Şikâyet reddedilsin mi?", "İçerik değişmez; şikâyet kapatılır.", "Reddet"],
      hide_content: ["İçerik gizlensin mi?", "İçerik herkese kapatılır.", "İçeriği gizle"],
      suspend_user: [
        "Kullanıcı askıya alınsın mı?",
        "Kullanıcı oturum açamaz.",
        "Kullanıcıyı askıya al",
      ],
    }[action];
    confirm({
      title: text[0],
      consequence: text[1],
      confirmLabel: text[2],
      tone: action === "dismiss" ? "primary" : "danger",
      reason: "Karar notu",
      run: async (notes) => {
        await run(
          "reports.resolve",
          { params: { id: r.reportId }, body: { action, notes } },
          {
            success: "Şikâyet karara bağlandı.",
            after: reload,
          },
        );
      },
    });
  };
  return (
    <AreaFrame
      loading={loading}
      error={errors.reports}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{ title: "Bekleyen şikâyet yok." }}
    >
      <RecordTable
        caption="Şikâyetler"
        rows={rows}
        rowKey={(r) => r.reportId}
        searchLabel="Şikâyet ara"
        searchText={(r) => `${r.reason} ${r.contentId} ${r.contentType}`}
        csvName="sikayetler"
        columns={[
          { key: "reason", header: "Gerekçe", rowHeader: true },
          { key: "contentType", header: "Tür", sortable: true },
          { key: "contentId", header: "İçerik" },
          { key: "status", header: "Durum", sortable: true, render: (r) => statusBadge(r.status) },
          {
            key: "createdAt",
            header: "Tarih",
            sortable: true,
            render: (r) => formatDate(r.createdAt),
          },
          {
            key: "actions",
            header: "İşlemler",
            render: (r) =>
              r.status === "pending" ? (
                <div className="admin-row-actions">
                  <Button variant="secondary" size="sm" onClick={() => resolve(r, "dismiss")}>
                    Reddet
                  </Button>
                  {/* I10: aksiyon içerik türüne göre — kullanıcı şikâyetinde gizleme yok. */}
                  {r.contentType === "user" ? (
                    <Button variant="danger" size="sm" onClick={() => resolve(r, "suspend_user")}>
                      Kullanıcıyı askıya al
                    </Button>
                  ) : (
                    <Button variant="danger" size="sm" onClick={() => resolve(r, "hide_content")}>
                      İçeriği gizle
                    </Button>
                  )}
                </div>
              ) : (
                <span className="admin-muted">{r.resolutionNotes || "—"}</span>
              ),
          },
        ]}
      />
      {confirmNode}
    </AreaFrame>
  );
}

const rowId = (r: AdminRow) => String(r.routeId ?? String(r.SK ?? "").replace(/^ROUTE#/, ""));

function Routes() {
  const run = useAdminMutation();
  const [confirmNode, confirm] = useConfirm();
  const [editing, setEditing] = useState<AdminRow | null>(null);
  const { data, errors, loading, reload } = useAreaData(["routes"] as const, {
    routes: { query: { limit: 100 } },
  });
  const rows = data.routes?.routes ?? [];
  const act = (r: AdminRow, action: "approve" | "feature" | "suspend") => {
    const text = {
      approve: ["Rota onaylansın mı?", "Rota toplulukta görünür.", "Onayla"],
      feature: ["Rota öne çıkarılsın mı?", "Rota keşfet akışında öne çıkar.", "Öne çıkar"],
      suspend: ["Rota askıya alınsın mı?", "Rota toplulukta gizlenir.", "Askıya al"],
    }[action];
    confirm({
      title: text[0],
      consequence: text[1],
      confirmLabel: text[2],
      tone: action === "suspend" ? "danger" : "primary",
      run: async (reason) => {
        await run(
          "routes.action",
          { params: { id: rowId(r) }, body: { action, reason } },
          {
            success: "Rota güncellendi.",
            after: reload,
          },
        );
      },
    });
  };
  return (
    <AreaFrame
      loading={loading}
      error={errors.routes}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{ title: "Henüz rota yok." }}
    >
      <RecordTable
        caption="Rotalar"
        rows={rows}
        rowKey={rowId}
        searchLabel="Rota ara"
        searchText={(r) => `${r.name ?? ""} ${r.description ?? ""} ${rowId(r)}`}
        csvName="rotalar"
        columns={[
          {
            key: "name",
            header: "Rota",
            rowHeader: true,
            sortable: true,
            render: (r) => String(r.name ?? "—"),
          },
          {
            key: "adminStatus",
            header: "Durum",
            sortable: true,
            render: (r) => statusBadge(r.adminStatus),
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
                <Button variant="secondary" size="sm" onClick={() => act(r, "approve")}>
                  Onayla
                </Button>
                <Button variant="secondary" size="sm" onClick={() => act(r, "feature")}>
                  Öne çıkar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
                  Düzenle
                </Button>
                <Button variant="danger" size="sm" onClick={() => act(r, "suspend")}>
                  Askıya al
                </Button>
              </div>
            ),
          },
        ]}
      />
      {confirmNode}
      <EditDialog
        open={editing !== null}
        title="Rota ayrıntılarını düzenle"
        fields={[
          { name: "name", label: "Ad", required: true, maxLength: 120 },
          { name: "description", label: "Açıklama", type: "textarea", maxLength: 2000 },
        ]}
        initial={{ name: editing?.name, description: editing?.description }}
        onClose={() => setEditing(null)}
        onSubmit={async (values, reason) => {
          if (!editing) return;
          await run(
            "routes.details",
            {
              params: { id: rowId(editing) },
              body: { ...values, reason, version: editing.version ?? 0 },
            },
            { success: "Rota güncellendi.", after: reload },
          );
        }}
      />
    </AreaFrame>
  );
}

function Shares() {
  const run = useAdminMutation();
  const [confirmNode, confirm] = useConfirm();
  const { data, errors, loading, reload } = useAreaData(["shares"] as const);
  const rows = data.shares ? mapShares(data.shares) : [];
  return (
    <AreaFrame
      loading={loading}
      error={errors.shares}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{ title: "Etkin konum paylaşımı yok." }}
    >
      <RecordTable
        caption="Konum paylaşımları"
        rows={rows}
        rowKey={(s) => s.id}
        searchLabel="Paylaşım ara"
        searchText={(s) => `${s.id} ${s.owner} ${s.address}`}
        csvName="paylasimlar"
        columns={[
          { key: "id", header: "Kod", rowHeader: true },
          { key: "type", header: "Tür", render: (s) => (s.type === "route" ? "Rota" : "Konum") },
          { key: "owner", header: "Sahibi" },
          { key: "status", header: "Durum", sortable: true, render: (s) => statusBadge(s.status) },
          {
            key: "expiresAt",
            header: "Bitiş",
            sortable: true,
            render: (s) => formatDate(s.expiresAt),
          },
          {
            key: "actions",
            header: "İşlemler",
            render: (s) =>
              s.revocable ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    confirm({
                      title: "Paylaşım iptal edilsin mi?",
                      consequence: "Bağlantı hemen geçersiz olur; alıcı konumu göremez.",
                      confirmLabel: "Paylaşımı iptal et",
                      run: async (reason) => {
                        await run(
                          "shares.revoke",
                          { params: { id: s.id }, body: { reason } },
                          {
                            success: "Paylaşım iptal edildi.",
                            after: reload,
                          },
                        );
                      },
                    })
                  }
                >
                  İptal et
                </Button>
              ) : null,
          },
        ]}
      />
      {confirmNode}
    </AreaFrame>
  );
}

function Profiles() {
  const run = useAdminMutation();
  const [confirmNode, confirm] = useConfirm();
  const { data, errors, loading, reload } = useAreaData(["profiles"] as const);
  const rows = data.profiles?.profiles ?? [];
  const moderate = (id: string, action: "approve" | "suspend") =>
    confirm({
      title: action === "approve" ? "Profil onaylansın mı?" : "Profil askıya alınsın mı?",
      consequence:
        action === "approve" ? "Profil herkese açık görünür." : "Profil herkese kapatılır.",
      confirmLabel: action === "approve" ? "Onayla" : "Askıya al",
      tone: action === "approve" ? "primary" : "danger",
      run: async (reason) => {
        await run(
          "profiles.moderate",
          { params: { id }, body: { action, reason } },
          {
            success: "Profil güncellendi.",
            after: reload,
          },
        );
      },
    });
  return (
    <AreaFrame
      loading={loading}
      error={errors.profiles}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{ title: "Herkese açık profil yok." }}
    >
      <RecordTable
        caption="Profiller"
        rows={rows}
        rowKey={(r) => r.id}
        searchLabel="Profil ara"
        searchText={(r) => `${r.id} ${r.name ?? ""} ${r.owner ?? ""}`}
        csvName="profiller"
        columns={[
          { key: "name", header: "Ad", rowHeader: true, render: (r) => r.name ?? "—" },
          { key: "id", header: "Kullanıcı adı" },
          { key: "status", header: "Durum", sortable: true, render: (r) => statusBadge(r.status) },
          {
            key: "actions",
            header: "İşlemler",
            render: (r) => (
              <div className="admin-row-actions">
                {r.status !== "active" && (
                  <Button variant="secondary" size="sm" onClick={() => moderate(r.id, "approve")}>
                    Onayla
                  </Button>
                )}
                {r.status !== "suspended" && (
                  <Button variant="danger" size="sm" onClick={() => moderate(r.id, "suspend")}>
                    Askıya al
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />
      {confirmNode}
    </AreaFrame>
  );
}
