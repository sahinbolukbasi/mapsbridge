"use client";
// Kullanıcılar: tam liste (istemcide arama/sıralama/sayfalama), toplu askıya alma ve detay
// Modal'ı (profil, oturumlar, rol, kredi, cüzdan, abonelik, kredi hediyesi, askı). Aksiyonlar
// izne göre gösterilir (canRun; grant-credits UI'da yalnızca credits izni, F-3).
import { useEffect, useState } from "react";
import { Alert, Badge, Button, LoadingState, Modal } from "../../../components/ui";
import type { UiError } from "../../../components/ui/logic/http-error";
import { adminRequest } from "../../../lib/admin/client";
import { toAdminError } from "../../../lib/admin/errors";
import { mapUsers, type UserView } from "../../../lib/admin/mappers";
import { canRun } from "../../../lib/admin/rbac";
import { newRequestId } from "../../../lib/admin/request-id";
import type { AdminUserDetail } from "../../../lib/admin/types";
import { AreaFrame, DetailList, Panel } from "../area-frame";
import { useConfirm } from "../confirm-action";
import { EditDialog, type FieldSpec } from "../edit-dialog";
import { formatDate, formatDay, formatNumber, ROLE_LABELS, statusLabel } from "../format";
import { RecordTable } from "../record-table";
import { useAdmin, useAdminMutation, useAreaData, useRefreshHold } from "../use-area-data";

type Dialog =
  | { kind: "profile" }
  | { kind: "role" }
  | { kind: "credits"; requestId: string }
  | { kind: "grant" }
  | null;

export function KullanicilarArea() {
  const { session } = useAdmin();
  const run = useAdminMutation();
  const { data, errors, loading, reload } = useAreaData(["users.list"] as const, {
    "users.list": { query: { limit: 200 } },
  });
  const users = data["users.list"] ? mapUsers(data["users.list"]) : [];
  const [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmNode, confirm] = useConfirm();

  const suspend = (u: UserView) =>
    confirm({
      title: `${u.name || u.email} askıya alınsın mı?`,
      consequence: "Kullanıcı oturum açamaz ve içerikleri gizlenir. İşlem geçmişine yazılır.",
      confirmLabel: "Askıya al",
      run: async (reason) => {
        await run(
          "users.suspend",
          { params: { id: u.id }, body: { reason } },
          {
            success: "Kullanıcı askıya alındı.",
            after: reload,
          },
        );
      },
    });
  const unsuspend = (u: UserView) =>
    confirm({
      title: `${u.name || u.email} için askı kaldırılsın mı?`,
      consequence: "Kullanıcı yeniden oturum açabilir.",
      confirmLabel: "Askıyı kaldır",
      tone: "primary",
      run: async (reason) => {
        await run(
          "users.unsuspend",
          { params: { id: u.id }, body: { reason } },
          {
            success: "Askı kaldırıldı.",
            after: reload,
          },
        );
      },
    });
  const bulkSuspend = () =>
    confirm({
      title: `${selected.length} kullanıcı askıya alınsın mı?`,
      consequence: "Her kullanıcı için ayrı istek gönderilir; sonuç özeti gösterilir.",
      confirmLabel: "Seçilenleri askıya al",
      run: async (reason) => {
        const failed: string[] = [];
        for (const id of selected) {
          try {
            await run("users.suspend", { params: { id }, body: { reason } });
          } catch {
            failed.push(id);
          }
        }
        setSelected([]);
        reload();
        if (failed.length)
          throw new Error(
            `${selected.length - failed.length} başarılı, ${failed.length} başarısız: ${failed.join(", ")}`,
          );
      },
    });

  const canSuspend = canRun(session, "users.suspend");

  return (
    <Panel title="Kullanıcı listesi">
      <AreaFrame
        level={3}
        loading={loading}
        error={errors["users.list"]}
        onRetry={reload}
        isEmpty={users.length === 0}
        empty={{ title: "Henüz kullanıcı yok." }}
      >
        <RecordTable
          caption="Kullanıcılar"
          rows={users}
          rowKey={(u) => u.id}
          searchLabel="Ad veya e-posta ara"
          searchText={(u) => `${u.name} ${u.email} ${u.id}`}
          csvName="kullanicilar"
          selectable={canSuspend}
          selected={selected}
          onSelectedChange={setSelected}
          toolbar={
            canSuspend &&
            selected.length > 0 && (
              <Button variant="danger" size="sm" onClick={bulkSuspend}>
                Seçilenleri askıya al ({selected.length})
              </Button>
            )
          }
          columns={[
            {
              key: "name",
              header: "Ad",
              sortable: true,
              rowHeader: true,
              render: (u) => u.name || "—",
            },
            { key: "email", header: "E-posta", sortable: true },
            {
              key: "role",
              header: "Rol",
              value: (u) => u.role,
              render: (u) => ROLE_LABELS[u.role] ?? u.role,
            },
            { key: "tier", header: "Plan", sortable: true },
            {
              key: "suspended",
              header: "Durum",
              value: (u) => (u.suspended ? "Askıda" : "Etkin"),
              render: (u) =>
                u.suspended ? (
                  <Badge tone="danger">Askıda</Badge>
                ) : (
                  <Badge tone="success">Etkin</Badge>
                ),
            },
            { key: "routesCount", header: "Rota", align: "end", sortable: true },
            {
              key: "createdAt",
              header: "Kayıt",
              sortable: true,
              render: (u) => formatDay(u.createdAt),
            },
            {
              key: "actions",
              header: "İşlemler",
              render: (u) => (
                <div className="admin-row-actions">
                  <Button variant="secondary" size="sm" onClick={() => setDetailId(u.id)}>
                    Ayrıntılar
                  </Button>
                  {canSuspend &&
                    (u.suspended ? (
                      <Button variant="ghost" size="sm" onClick={() => unsuspend(u)}>
                        Askıyı kaldır
                      </Button>
                    ) : (
                      <Button variant="danger" size="sm" onClick={() => suspend(u)}>
                        Askıya al
                      </Button>
                    ))}
                </div>
              ),
            },
          ]}
        />
      </AreaFrame>
      {confirmNode}
      <UserDetail
        user={users.find((u) => u.id === detailId) ?? null}
        onClose={() => setDetailId(null)}
        onChanged={reload}
        onSuspend={suspend}
        onUnsuspend={unsuspend}
      />
    </Panel>
  );
}

function UserDetail({
  user,
  onClose,
  onChanged,
  onSuspend,
  onUnsuspend,
}: {
  user: UserView | null;
  onClose: () => void;
  onChanged: () => void;
  onSuspend: (u: UserView) => void;
  onUnsuspend: (u: UserView) => void;
}) {
  const { session } = useAdmin();
  const run = useAdminMutation();
  useRefreshHold(user !== null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [confirmNode, confirm] = useConfirm();
  const id = user?.id ?? null;

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setDetail(null);
    setError(null);
    adminRequest("users.detail", { params: { id } })
      .then((d) => alive && setDetail(d))
      .catch((err) => alive && setError(toAdminError(err, { endpointId: "users.detail" })));
    return () => {
      alive = false;
    };
  }, [id, version]);

  if (!user) return null;
  const refresh = () => {
    setVersion((v) => v + 1);
    onChanged();
  };
  const p = { id: user.id };
  const can = (eid: Parameters<typeof canRun>[1]) => canRun(session, eid);
  const wallet = detail?.wallet;
  const sub = detail?.subscription;

  const profileFields: FieldSpec[] = [
    { name: "name", label: "Ad", required: true, maxLength: 120 },
    {
      name: "phone",
      label: "Telefon",
      hint: "Uluslararası biçim, ör. +905551112233",
      pattern: { re: /^\+[1-9]\d{7,14}$/, message: "Telefon +905551112233 biçiminde olmalı." },
      autoComplete: "off",
    },
    { name: "notes", label: "Notlar", type: "textarea", maxLength: 4000 },
  ];

  return (
    <Modal open onClose={onClose} title={user.name || user.email || user.id} size="lg">
      {!detail && !error && <LoadingState label="Kullanıcı ayrıntıları yükleniyor…" />}
      {error && (
        <Alert tone="danger" title={error.title}>
          {error.message}
        </Alert>
      )}
      {detail && (
        <div className="admin-stack">
          <DetailList
            items={[
              ["Kullanıcı kimliği", detail.user.userId],
              ["E-posta", detail.user.email],
              ["Telefon", detail.user.phone],
              [
                "Durum",
                user.suspended ? `Askıda (${user.suspendReason || "gerekçe yok"})` : "Etkin",
              ],
              ["Rol", ROLE_LABELS[user.role] ?? user.role],
              ["Kredi", formatNumber(wallet?.credits)],
              ["Cüzdan", wallet?.frozen ? "Dondurulmuş" : "Açık"],
              ["Abonelik", sub ? `${sub.tier ?? "—"} · ${statusLabel(sub.status)}` : "Yok"],
              ["Kayıt", formatDate(detail.user.createdAt)],
              ["Notlar", detail.user.notes],
            ]}
          />
          <div className="admin-row-actions" role="group" aria-label="Kullanıcı işlemleri">
            {can("users.suspend") &&
              (user.suspended ? (
                <Button variant="secondary" size="sm" onClick={() => onUnsuspend(user)}>
                  Askıyı kaldır
                </Button>
              ) : (
                <Button variant="danger" size="sm" onClick={() => onSuspend(user)}>
                  Askıya al
                </Button>
              ))}
            {can("users.profile") && (
              <Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "profile" })}>
                Profili düzenle
              </Button>
            )}
            {can("users.sessions") && (
              <Button
                variant="danger"
                size="sm"
                onClick={() =>
                  confirm({
                    title: "Tüm oturumlar sonlandırılsın mı?",
                    consequence: "Kullanıcı tüm cihazlarda yeniden giriş yapmak zorunda kalır.",
                    confirmLabel: "Oturumları sonlandır",
                    run: async (reason) => {
                      await run(
                        "users.sessions",
                        { params: p, body: { reason } },
                        {
                          success: "Oturumlar sonlandırıldı.",
                          after: refresh,
                        },
                      );
                    },
                  })
                }
              >
                Oturumları sonlandır
              </Button>
            )}
            {can("users.role") && (
              <Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "role" })}>
                Rol değiştir
              </Button>
            )}
            {can("users.credits") && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDialog({ kind: "credits", requestId: newRequestId() })}
              >
                Bakiye düzelt
              </Button>
            )}
            {can("users.wallet") && (
              <Button
                variant={wallet?.frozen ? "secondary" : "danger"}
                size="sm"
                onClick={() =>
                  confirm({
                    title: wallet?.frozen ? "Cüzdan açılsın mı?" : "Cüzdan dondurulsun mu?",
                    consequence: wallet?.frozen
                      ? "Kullanıcı yeniden kredi harcayabilir."
                      : "Kullanıcı kredi harcayamaz ve kredi alamaz.",
                    confirmLabel: wallet?.frozen ? "Cüzdanı aç" : "Cüzdanı dondur",
                    tone: wallet?.frozen ? "primary" : "danger",
                    run: async (reason) => {
                      await run(
                        "users.wallet",
                        { params: p, body: { reason, frozen: !wallet?.frozen } },
                        {
                          success: "Cüzdan güncellendi.",
                          after: refresh,
                        },
                      );
                    },
                  })
                }
              >
                {wallet?.frozen ? "Cüzdanı aç" : "Cüzdanı dondur"}
              </Button>
            )}
            {can("users.subscription") && sub?.tier && sub.tier !== "free" && (
              <Button
                variant={sub.status === "active" ? "danger" : "secondary"}
                size="sm"
                onClick={() => {
                  const cancel = sub.status === "active";
                  confirm({
                    title: cancel ? "Abonelik iptal edilsin mi?" : "Abonelik sürdürülsün mü?",
                    consequence: cancel
                      ? "Abonelik dönem sonunda sona erer; Stripe'a iptal isteği gönderilir."
                      : "Abonelik yenilenmeye devam eder.",
                    confirmLabel: cancel ? "Aboneliği iptal et" : "Aboneliği sürdür",
                    tone: cancel ? "danger" : "primary",
                    run: async (reason) => {
                      await run(
                        "users.subscription",
                        { params: p, body: { reason, action: cancel ? "cancel" : "resume" } },
                        { success: "Abonelik güncellendi.", after: refresh },
                      );
                    },
                  });
                }}
              >
                {sub.status === "active" ? "Aboneliği iptal et" : "Aboneliği sürdür"}
              </Button>
            )}
            {can("users.grantCredits") && (
              <Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "grant" })}>
                Kredi hediye et
              </Button>
            )}
          </div>
        </div>
      )}
      {confirmNode}
      <EditDialog
        open={dialog?.kind === "profile"}
        title="Profili düzenle"
        fields={profileFields}
        initial={{ name: detail?.user.name, phone: detail?.user.phone, notes: detail?.user.notes }}
        onClose={() => setDialog(null)}
        onSubmit={async (values, reason) => {
          await run(
            "users.profile",
            { params: p, body: { ...values, reason, version: detail?.user.version ?? 0 } },
            { success: "Profil güncellendi.", after: refresh },
          );
        }}
      />
      <EditDialog
        open={dialog?.kind === "role"}
        title="Rol değiştir"
        tone="danger"
        description="Yönetici rolüne yükseltme tüm yönetim izinlerini verir."
        fields={[
          {
            name: "role",
            label: "Yeni rol",
            type: "select",
            required: true,
            options: ["user", "support", "moderator", "admin"].map((r) => ({
              value: r,
              label: ROLE_LABELS[r],
            })),
          },
        ]}
        initial={{ role: user.role }}
        typedConfirmation={(v) => (v.role === "admin" ? user.email || user.id : null)}
        submitLabel="Rolü değiştir"
        onClose={() => setDialog(null)}
        onSubmit={async (values, reason) => {
          await run(
            "users.role",
            { params: p, body: { role: values.role, reason } },
            {
              success: "Rol güncellendi.",
              after: refresh,
            },
          );
        }}
      />
      <EditDialog
        open={dialog?.kind === "credits"}
        title="Bakiye düzelt"
        description="Negatif değer bakiyeden düşer. Aynı dialogdaki tekrar denemeler aynı işlem kimliğini kullanır."
        fields={[
          {
            name: "delta",
            label: "Kredi değişimi",
            type: "number",
            integer: true,
            required: true,
            min: -10000,
            max: 10000,
            hint: "−10.000 ile 10.000 arası, 0 olamaz.",
            pattern: { re: /^-?[1-9]\d*$/, message: "Kredi değişimi 0 olamaz." },
          },
        ]}
        onClose={() => setDialog(null)}
        onSubmit={async (values, reason) => {
          await run(
            "users.credits",
            {
              params: p,
              body: {
                delta: values.delta,
                reason,
                requestId: dialog?.kind === "credits" ? dialog.requestId : newRequestId(),
              },
            },
            { success: "Bakiye güncellendi.", after: refresh },
          );
        }}
      />
      <EditDialog
        open={dialog?.kind === "grant"}
        title="Kredi hediye et"
        fields={[
          {
            name: "credits",
            label: "Kredi",
            type: "number",
            integer: true,
            required: true,
            min: 1,
            max: 10000,
          },
        ]}
        onClose={() => setDialog(null)}
        onSubmit={async (values, reason) => {
          await run(
            "users.grantCredits",
            { params: p, body: { credits: values.credits, reason } },
            { success: "Kredi hediye edildi.", after: refresh },
          );
        }}
      />
    </Modal>
  );
}
