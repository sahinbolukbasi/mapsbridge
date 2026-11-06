"use client";
// AI operasyonları: kontrol, ajanlar, eğitim + fine-tune, release, maliyet/token, kullanım,
// AgentCore. I10: bağlı olmayan ajanda "aç", kapıyı geçmeyen adayda "yayınla", önceki sürümü
// olmayan release'de "geri al" gösterilmez. Fine-tune ücretli iştir (ConfirmDialog danger).
import { useState, type ReactNode } from "react";
import { Alert, Badge, Button, Tabs } from "../../../components/ui";
import { mapRelease, mapTokenUsage } from "../../../lib/admin/mappers";
import type { AdminReleaseCandidate, AdminRow } from "../../../lib/admin/types";
import { AreaFrame, DetailList, KpiGrid, Panel } from "../area-frame";
import { useConfirm } from "../confirm-action";
import { EditDialog } from "../edit-dialog";
import { formatDate, formatNumber, formatRate, statusLabel } from "../format";
import { RecordTable } from "../record-table";
import { useAdminMutation, useAreaData } from "../use-area-data";

export function AiArea() {
  return (
    <Tabs
      urlParam="sekme"
      label="AI operasyon bölümleri"
      items={[
        { id: "kontrol", label: "Kontrol", panel: <Control /> },
        { id: "ajanlar", label: "Ajanlar", panel: <Agents /> },
        { id: "egitim", label: "Eğitim", panel: <Training /> },
        { id: "release", label: "Release", panel: <Release /> },
        { id: "maliyet", label: "Maliyet ve token", panel: <Cost /> },
        { id: "kullanim", label: "Kullanım kayıtları", panel: <Usage /> },
        { id: "agentcore", label: "AgentCore", panel: <AgentCore /> },
      ]}
    />
  );
}

function Control() {
  const run = useAdminMutation();
  const [open, setOpen] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);
  const { data, errors, loading, reload } = useAreaData(["aiOperations"] as const);
  const ops = data.aiOperations;
  const models = ops?.runtime?.models ?? [];
  return (
    <AreaFrame loading={loading} error={errors.aiOperations} onRetry={reload}>
      <Panel
        title="AI kontrolü"
        actions={
          ops?.runtime && (
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              Düzenle
            </Button>
          )
        }
      >
        {!ops?.runtime && (
          <Alert tone="warning">
            AI çalışma ortamı bilgisi alınamadı; model seçimi şu an yapılamaz.
          </Alert>
        )}
        <DetailList
          items={[
            [
              "AI",
              ops?.control.enabled ? (
                <Badge tone="success">Açık</Badge>
              ) : (
                <Badge tone="danger">Kapalı</Badge>
              ),
            ],
            ["Varsayılan model", ops?.control.defaultModel],
            ["Devre dışı modeller", ops?.control.disabledModels.join(", ") || "Yok"],
            ["Çalışan birincil model", ops?.runtime?.primaryModel],
            ["Gözlem", formatDate(ops?.observedAt)],
          ]}
        />
      </Panel>
      <Panel
        title="Yer servisi (harita araması, keşif)"
        actions={
          ops?.runtime && (
            <Button variant="secondary" size="sm" onClick={() => setPlacesOpen(true)}>
              Düzenle
            </Button>
          )
        }
      >
        <DetailList
          items={[
            [
              "Google Places",
              ops?.places?.googleEnabled ? (
                <Badge tone="success">Açık</Badge>
              ) : (
                <Badge tone="neutral">Kapalı (Amazon Location)</Badge>
              ),
            ],
            ["Kullanıcı başına günlük arama", formatNumber(ops?.places?.userDailyLimit)],
            ["Aylık Google çağrı bütçesi", formatNumber(ops?.places?.monthlyGoogleCalls)],
          ]}
        />
      </Panel>
      <EditDialog
        open={open}
        title="AI kontrolü"
        tone="danger"
        description="AI'yı kapatmak tüm kullanıcılar için asistanı durdurur."
        fields={[
          { name: "enabled", label: "AI açık", type: "checkbox" },
          {
            name: "defaultModel",
            label: "Varsayılan model",
            type: "select",
            required: true,
            options: models.map((m) => ({ value: m, label: m })),
          },
          {
            name: "disabledModels",
            label: "Devre dışı modeller",
            type: "multi",
            options: models.map((m) => ({ value: m, label: m })),
          },
        ]}
        initial={{
          enabled: ops?.control.enabled,
          defaultModel: ops?.control.defaultModel,
          disabledModels: ops?.control.disabledModels,
        }}
        onClose={() => setOpen(false)}
        onSubmit={async (values, reason) => {
          await run(
            "ai.control",
            { body: { ...values, reason, version: ops?.control.version ?? 0 } },
            { success: "AI kontrolü güncellendi.", after: reload },
          );
        }}
      />
      <EditDialog
        open={placesOpen}
        title="Yer servisi"
        tone="danger"
        description="Google Places ücretlidir. Kapalıyken arama ve keşif Amazon Location ile çalışır."
        fields={[
          { name: "googleEnabled", label: "Google Places açık", type: "checkbox" },
          {
            name: "userDailyLimit",
            label: "Kullanıcı başına günlük arama",
            type: "number",
            required: true,
            min: 0,
            max: 10000,
          },
          {
            name: "monthlyGoogleCalls",
            label: "Aylık Google çağrı bütçesi",
            type: "number",
            required: true,
            min: 0,
            max: 1000000,
          },
        ]}
        initial={{
          googleEnabled: ops?.places?.googleEnabled ?? false,
          userDailyLimit: ops?.places?.userDailyLimit ?? 300,
          monthlyGoogleCalls: ops?.places?.monthlyGoogleCalls ?? 0,
        }}
        onClose={() => setPlacesOpen(false)}
        onSubmit={async (values, reason) => {
          // Mevcut AI ayarları aynen gönderilir; yalnız places değişir.
          await run(
            "ai.control",
            {
              body: {
                enabled: ops?.control.enabled,
                defaultModel: ops?.control.defaultModel,
                disabledModels: ops?.control.disabledModels,
                version: ops?.control.version ?? 0,
                reason,
                places: values,
              },
            },
            { success: "Yer servisi ayarları güncellendi.", after: reload },
          );
        }}
      />
    </AreaFrame>
  );
}

function Agents() {
  const run = useAdminMutation();
  const [confirmNode, confirm] = useConfirm();
  const { data, errors, loading, reload } = useAreaData(["aiAgents"] as const);
  const rows = data.aiAgents?.agents ?? [];
  return (
    <AreaFrame
      loading={loading}
      error={errors.aiAgents}
      onRetry={reload}
      isEmpty={!rows.length}
      empty={{ title: "Tanımlı ajan yok." }}
    >
      <RecordTable
        caption="Ajanlar"
        rows={rows}
        rowKey={(a) => a.id}
        columns={[
          { key: "name", header: "Ajan", rowHeader: true },
          { key: "description", header: "Görev" },
          { key: "wired", header: "Bağlı", render: (a) => (a.wired ? "Evet" : "Hayır") },
          {
            key: "enabled",
            header: "Durum",
            render: (a) =>
              a.enabled ? <Badge tone="success">Açık</Badge> : <Badge tone="neutral">Kapalı</Badge>,
          },
          {
            key: "actions",
            header: "İşlemler",
            render: (a) =>
              a.enabled || a.wired ? (
                <Button
                  variant={a.enabled ? "danger" : "secondary"}
                  size="sm"
                  onClick={() =>
                    confirm({
                      title: a.enabled ? `${a.name} kapatılsın mı?` : `${a.name} açılsın mı?`,
                      consequence: a.enabled
                        ? "Ajan yeni isteklerde çalışmaz."
                        : "Ajan yeni isteklerde çalışır.",
                      confirmLabel: a.enabled ? "Kapat" : "Aç",
                      tone: a.enabled ? "danger" : "primary",
                      run: async (reason) => {
                        await run(
                          "aiAgents.config",
                          { params: { id: a.id }, body: { reason, enabled: !a.enabled } },
                          {
                            success: "Ajan güncellendi.",
                            after: reload,
                          },
                        );
                      },
                    })
                  }
                >
                  {a.enabled ? "Kapat" : "Aç"}
                </Button>
              ) : (
                <span className="admin-muted">Çalışma ortamına bağlı değil</span>
              ),
          },
        ]}
      />
      {confirmNode}
    </AreaFrame>
  );
}

function Training() {
  const run = useAdminMutation();
  const [confirmNode, confirm] = useConfirm();
  const [reviewing, setReviewing] = useState<AdminRow | null>(null);
  const { data, errors, loading, reload } = useAreaData(["aiTraining", "aiTrainingJobs"] as const);
  const records = data.aiTraining?.records ?? [];
  const jobs = data.aiTrainingJobs?.jobs ?? [];
  const policy = data.aiTraining?.policy;
  const approved = records.filter((r) => r.status === "approved").length;
  return (
    <div className="admin-stack">
      <Panel
        title="Eğitim kuyruğu"
        actions={
          approved > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={() =>
                confirm({
                  title: "Fine-tune işi başlatılsın mı?",
                  consequence: `${approved} onaylı kayıtla Bedrock'ta ücretli bir eğitim işi başlatılır. İş başladıktan sonra durdurulsa da ücret oluşabilir.`,
                  confirmLabel: "Fine-tune başlat",
                  reason: false,
                  run: async () => {
                    await run(
                      "aiTraining.fineTune",
                      { body: {} },
                      {
                        success: "Fine-tune işi başlatıldı.",
                        after: reload,
                      },
                    );
                  },
                })
              }
            >
              Fine-tune başlat
            </Button>
          )
        }
      >
        <AreaFrame
          level={3}
          loading={loading}
          error={errors.aiTraining}
          onRetry={reload}
          isEmpty={!records.length}
          empty={{ title: "İnceleme bekleyen kayıt yok." }}
        >
          {policy && (
            <p className="admin-muted">
              Otomatik eğitim kapalı · insan onayı{" "}
              {policy.requiresHumanReview ? "zorunlu" : "isteğe bağlı"} · saklama{" "}
              {policy.retentionDays} gün · PII kuyruktan önce maskelenir.
            </p>
          )}
          <RecordTable
            caption="Eğitim kayıtları"
            rows={records}
            rowKey={(r) => String(r.id)}
            columns={[
              {
                key: "summary",
                header: "Özet",
                rowHeader: true,
                render: (r) => String(r.summary ?? r.id),
              },
              { key: "status", header: "Durum", render: (r) => statusLabel(r.status) },
              { key: "createdAt", header: "Tarih", render: (r) => formatDate(r.createdAt) },
              {
                key: "actions",
                header: "İşlemler",
                render: (r) => (
                  <Button variant="secondary" size="sm" onClick={() => setReviewing(r)}>
                    İncele
                  </Button>
                ),
              },
            ]}
          />
        </AreaFrame>
      </Panel>
      <Panel title="Fine-tune işleri">
        <AreaFrame
          level={3}
          loading={loading}
          error={errors.aiTrainingJobs}
          onRetry={reload}
          isEmpty={!jobs.length}
          empty={{ title: "Henüz fine-tune işi yok." }}
        >
          <RecordTable
            caption="Fine-tune işleri"
            rows={jobs}
            rowKey={(j) => String(j.jobName ?? j.jobArn)}
            columns={[
              {
                key: "jobName",
                header: "İş",
                rowHeader: true,
                render: (j) => String(j.jobName ?? "—"),
              },
              { key: "status", header: "Durum", render: (j) => String(j.status ?? "—") },
              {
                key: "baseModelId",
                header: "Temel model",
                render: (j) => String(j.baseModelId ?? "—"),
              },
              { key: "createdAt", header: "Tarih", render: (j) => formatDate(j.createdAt) },
            ]}
          />
        </AreaFrame>
      </Panel>
      {confirmNode}
      <EditDialog
        open={reviewing !== null}
        title="Eğitim kaydını incele"
        description={reviewing ? String(reviewing.summary ?? reviewing.id) : undefined}
        fields={[
          {
            name: "action",
            label: "Karar",
            type: "select",
            required: true,
            options: [
              { value: "approve", label: "Onayla" },
              { value: "reject", label: "Reddet" },
              { value: "hold", label: "Beklet" },
            ],
          },
        ]}
        initial={{ action: "approve" }}
        onClose={() => setReviewing(null)}
        onSubmit={async (values, reason) => {
          if (!reviewing) return;
          await run(
            "aiTraining.review",
            { params: { id: String(reviewing.id) }, body: { action: values.action, reason } },
            {
              success: "Kayıt güncellendi.",
              after: reload,
            },
          );
        }}
      />
    </div>
  );
}

const METRICS: Array<[string, string]> = [
  ["schemaPassRate", "Şema geçiş oranı"],
  ["routeValidityRate", "Rota geçerlilik oranı"],
  ["sourceCoverageRate", "Kaynak kapsama oranı"],
  ["decisionSummarySafetyRate", "Karar özeti güvenlik oranı"],
  ["p95LatencyMs", "p95 gecikme (ms)"],
];

function candidateItems(c: AdminReleaseCandidate | null | undefined): Array<[string, ReactNode]> {
  if (!c) return [["Durum", "Yok"]];
  return [
    ["Model", c.model],
    ["Prompt sürümü", c.promptVersion],
    [
      "Kalite kapısı",
      c.qualityGate === "passed" ? (
        <Badge tone="success">Geçti</Badge>
      ) : (
        <Badge tone="danger">Geçmedi</Badge>
      ),
    ],
  ];
}

function Release() {
  const run = useAdminMutation();
  const [confirmNode, confirm] = useConfirm();
  const [proposing, setProposing] = useState(false);
  const { data, errors, loading, reload } = useAreaData(["aiRelease", "aiOperations"] as const);
  const view = data.aiRelease ? mapRelease(data.aiRelease) : null;
  const models = data.aiOperations?.runtime?.models ?? [];
  const thresholds = data.aiRelease?.thresholds ?? {};
  return (
    <AreaFrame loading={loading} error={errors.aiRelease} onRetry={reload}>
      <div className="admin-stack">
        <Panel
          title="Aday"
          actions={
            <div className="admin-row-actions">
              {models.length > 0 && (
                <Button variant="secondary" size="sm" onClick={() => setProposing(true)}>
                  Aday öner
                </Button>
              )}
              {view?.canPublish && (
                <Button
                  size="sm"
                  onClick={() =>
                    confirm({
                      title: "Aday yayınlansın mı?",
                      consequence:
                        "Aday sürüm etkin sürüm olur; mevcut sürüm geri alınabilir olarak saklanır.",
                      confirmLabel: "Yayınla",
                      tone: "primary",
                      run: async (reason) => {
                        await run(
                          "aiRelease.publish",
                          { body: { reason } },
                          { success: "Aday yayınlandı.", after: reload },
                        );
                      },
                    })
                  }
                >
                  Yayınla
                </Button>
              )}
            </div>
          }
        >
          <DetailList items={candidateItems(view?.release.candidate)} />
        </Panel>
        <Panel
          title="Etkin sürüm"
          actions={
            view?.canRollback && (
              <Button
                variant="danger"
                size="sm"
                onClick={() =>
                  confirm({
                    title: "Önceki sürüme dönülsün mü?",
                    consequence: "Etkin sürüm önceki sürümle değiştirilir.",
                    confirmLabel: "Geri al",
                    run: async (reason) => {
                      await run(
                        "aiRelease.rollback",
                        { body: { reason } },
                        { success: "Önceki sürüme dönüldü.", after: reload },
                      );
                    },
                  })
                }
              >
                Geri al
              </Button>
            )
          }
        >
          <DetailList
            items={[
              ...candidateItems(view?.release.active),
              ["Yayın tarihi", formatDate(view?.release.active?.publishedAt)],
              ["Önceki sürüm", view?.release.previousActive?.model ?? "Yok"],
            ]}
          />
        </Panel>
      </div>
      {confirmNode}
      <EditDialog
        open={proposing}
        title="Release adayı öner"
        description="Metrikler kalite kapısı eşikleriyle karşılaştırılır; kapıyı geçmeyen aday yayınlanamaz."
        fields={[
          {
            name: "model",
            label: "Model",
            type: "select",
            required: true,
            options: models.map((m) => ({ value: m, label: m })),
          },
          { name: "promptVersion", label: "Prompt sürümü", required: true, maxLength: 100 },
          ...METRICS.map(([k, label]) => ({
            name: k,
            label: `${label} (eşik ${thresholds[k] ?? "—"})`,
            type: "number" as const,
            required: true,
            min: 0,
            max: k === "p95LatencyMs" ? undefined : 1,
          })),
        ]}
        initial={{ model: models[0] }}
        onClose={() => setProposing(false)}
        onSubmit={async (values, reason) => {
          const metrics = Object.fromEntries(METRICS.map(([k]) => [k, values[k]]));
          await run(
            "aiRelease.propose",
            { body: { reason, model: values.model, promptVersion: values.promptVersion, metrics } },
            { success: "Aday önerildi.", after: reload },
          );
        }}
      />
    </AreaFrame>
  );
}

function Cost() {
  const { data, errors, loading, reload } = useAreaData(["tokenUsage"] as const);
  const usage = data.tokenUsage ? mapTokenUsage(data.tokenUsage) : null;
  return (
    <AreaFrame loading={loading} error={errors.tokenUsage} onRetry={reload}>
      {usage?.kind === "unavailable" ? (
        <Alert tone="info" title="Token verisi henüz bağlanmadı">
          {usage.note}
        </Alert>
      ) : (
        usage && (
          <div className="admin-stack">
            <p className="admin-muted">
              {formatDate(usage.period.from)} – {formatDate(usage.period.to)}
            </p>
            <KpiGrid
              label="Maliyet ve token"
              items={[
                { label: "İstek", value: formatNumber(usage.totalRequests) },
                { label: "Toplam token", value: formatNumber(usage.totalTokens) },
                { label: "Girdi token", value: formatNumber(usage.inputTokens) },
                { label: "Çıktı token", value: formatNumber(usage.outputTokens) },
                { label: "Tahmini maliyet (USD)", value: formatNumber(usage.estimatedCostUsd) },
                { label: "Başarı oranı", value: formatRate(usage.successRate) },
                { label: "Tamamlanan plan", value: formatNumber(usage.completedPlans) },
                { label: "Hata", value: formatNumber(usage.failures) },
              ]}
            />
            <p className="admin-muted">Etkin modeller: {usage.activeModels.join(", ") || "—"}</p>
          </div>
        )
      )}
    </AreaFrame>
  );
}

function Usage() {
  const { data, errors, loading, reload } = useAreaData(["usage"] as const);
  const rows = data.usage?.usage ?? [];
  return (
    <AreaFrame
      loading={loading}
      error={errors.usage}
      onRetry={reload}
      isEmpty={!rows.length}
      empty={{ title: "Henüz kullanım kaydı yok." }}
    >
      <RecordTable
        caption="Kullanım kayıtları"
        rows={rows}
        rowKey={(r) => r.id}
        searchLabel="Kullanıcı ara"
        searchText={(r) => `${r.userId ?? ""} ${r.id}`}
        csvName="ai-kullanim"
        columns={[
          {
            key: "createdAt",
            header: "Tarih",
            rowHeader: true,
            sortable: true,
            render: (r) => formatDate(r.createdAt),
          },
          { key: "userId", header: "Kullanıcı" },
          { key: "status", header: "Durum", sortable: true, render: (r) => statusLabel(r.status) },
          { key: "credits", header: "Kredi", align: "end", sortable: true },
        ]}
      />
    </AreaFrame>
  );
}

function AgentCore() {
  const { data, errors, loading, reload } = useAreaData(["agentcoreStatus"] as const);
  const s = data.agentcoreStatus;
  const g = (s?.gateway ?? {}) as Record<string, unknown>;
  const w = (s?.worker ?? {}) as Record<string, unknown>;
  return (
    <AreaFrame loading={loading} error={errors.agentcoreStatus} onRetry={reload}>
      <div className="admin-stack">
        <Panel title="Gateway">
          <DetailList
            items={[
              ["Ad", String(g.name ?? "Yapılandırılmadı")],
              ["Durum", String(g.status ?? "—")],
              ["Protokol", String(g.protocol ?? "—")],
              ["Bölge", s?.region],
            ]}
          />
        </Panel>
        <Panel title="Worker">
          <DetailList
            items={[
              ["Ad", String(w.name ?? "Yapılandırılmadı")],
              ["Durum", String(w.state ?? "—")],
              ["Son saat çağrı", formatNumber(w.invocationsLastHour)],
              ["Son saat hata", formatNumber(w.errorsLastHour)],
              ["DLQ mesajı", formatNumber(w.dlqMessages)],
              ["Son güncelleme", formatDate(w.lastUpdate)],
            ]}
          />
        </Panel>
      </div>
    </AreaFrame>
  );
}
