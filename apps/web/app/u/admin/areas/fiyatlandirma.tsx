"use client";
// Fiyatlandırma ve kredi: planlar, kredi paketleri, kredi istatistikleri, Stripe. Plan/paket/Stripe
// değişikliği önce/sonra tablosuyla onaylanır (confirmDiff). Stripe gizli anahtarları forma geri
// doldurulmaz, boş bırakılırsa gönderilmez; Toast/log'a yazılmaz.
import { useState } from "react";
import { Badge, Button, Tabs } from "../../../components/ui";
import type { AdminCreditPack, AdminPlan } from "../../../lib/admin/types";
import { AreaFrame, DetailList, KpiGrid, Panel } from "../area-frame";
import { EditDialog, type FieldSpec } from "../edit-dialog";
import { formatDate, formatNumber, formatTry } from "../format";
import { RecordTable } from "../record-table";
import { useAdminMutation, useAreaData } from "../use-area-data";

export function FiyatlandirmaArea() {
  return (
    <Tabs
      urlParam="sekme"
      label="Fiyatlandırma bölümleri"
      items={[
        { id: "planlar", label: "Planlar", panel: <Plans /> },
        { id: "paketler", label: "Kredi paketleri", panel: <Packs /> },
        { id: "istatistik", label: "Kredi istatistikleri", panel: <CreditStats /> },
        { id: "stripe", label: "Stripe", panel: <Stripe /> },
      ]}
    />
  );
}

const enabledBadge = (on: boolean) =>
  on ? <Badge tone="success">Açık</Badge> : <Badge tone="neutral">Kapalı</Badge>;
const money = (name: string, label: string): FieldSpec => ({
  name,
  label,
  type: "number",
  min: 0,
  required: true,
});

const PLAN_FIELDS: FieldSpec[] = [
  { name: "name", label: "Ad", required: true, maxLength: 80 },
  { name: "tagline", label: "Kısa açıklama", maxLength: 160 },
  { name: "badge", label: "Rozet", maxLength: 40 },
  money("monthlyPriceTry", "Aylık fiyat (TL)"),
  money("yearlyPriceTry", "Yıllık fiyat (TL)"),
  {
    name: "monthlyCredits",
    label: "Aylık kredi",
    type: "number",
    integer: true,
    min: 0,
    required: true,
  },
  { name: "stripePriceIdMonthly", label: "Stripe aylık fiyat kimliği", maxLength: 200 },
  { name: "stripePriceIdYearly", label: "Stripe yıllık fiyat kimliği", maxLength: 200 },
  { name: "enabled", label: "Satışta", type: "checkbox" },
];

function Plans() {
  const run = useAdminMutation();
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const { data, errors, loading, reload } = useAreaData(["plans"] as const);
  const rows = data.plans?.plans ?? [];
  return (
    <AreaFrame
      loading={loading}
      error={errors.plans}
      onRetry={reload}
      isEmpty={!rows.length}
      empty={{ title: "Tanımlı plan yok." }}
    >
      <RecordTable
        caption="Planlar"
        rows={rows}
        rowKey={(p) => p.id}
        csvName="planlar"
        columns={[
          { key: "name", header: "Plan", rowHeader: true },
          {
            key: "monthlyPriceTry",
            header: "Aylık",
            align: "end",
            render: (p) => formatTry(p.monthlyPriceTry),
          },
          {
            key: "yearlyPriceTry",
            header: "Yıllık",
            align: "end",
            render: (p) => formatTry(p.yearlyPriceTry),
          },
          { key: "monthlyCredits", header: "Kredi", align: "end", sortable: true },
          { key: "activeSubscribers", header: "Abone", align: "end", sortable: true },
          { key: "enabled", header: "Durum", render: (p) => enabledBadge(p.enabled) },
          {
            key: "actions",
            header: "İşlemler",
            render: (p) => (
              <Button variant="secondary" size="sm" onClick={() => setEditing(p)}>
                Düzenle
              </Button>
            ),
          },
        ]}
      />
      <EditDialog
        open={editing !== null}
        title={`Planı düzenle: ${editing?.name ?? ""}`}
        fields={PLAN_FIELDS}
        initial={editing ?? {}}
        confirmDiff
        onClose={() => setEditing(null)}
        onSubmit={async (values, reason) => {
          if (!editing) return;
          await run(
            "plans.update",
            { params: { id: editing.id }, body: { ...values, reason } },
            {
              success: "Plan güncellendi.",
              after: reload,
            },
          );
        }}
      />
    </AreaFrame>
  );
}

const PACK_FIELDS: FieldSpec[] = [
  { name: "title", label: "Başlık", required: true, maxLength: 80 },
  { name: "description", label: "Açıklama", type: "textarea", maxLength: 300 },
  { name: "credits", label: "Kredi", type: "number", integer: true, min: 1, required: true },
  {
    name: "bonusCredits",
    label: "Hediye kredi",
    type: "number",
    integer: true,
    min: 0,
    required: true,
  },
  money("priceTry", "Fiyat (TL)"),
  { name: "stripeProductId", label: "Stripe ürün kimliği", maxLength: 200 },
  { name: "popular", label: "Popüler olarak işaretle", type: "checkbox" },
  { name: "enabled", label: "Satışta", type: "checkbox" },
];

function Packs() {
  const run = useAdminMutation();
  const [editing, setEditing] = useState<AdminCreditPack | null>(null);
  const { data, errors, loading, reload } = useAreaData(["creditPacks"] as const);
  const rows = data.creditPacks?.packs ?? [];
  return (
    <AreaFrame
      loading={loading}
      error={errors.creditPacks}
      onRetry={reload}
      isEmpty={!rows.length}
      empty={{ title: "Tanımlı kredi paketi yok." }}
    >
      <RecordTable
        caption="Kredi paketleri"
        rows={rows}
        rowKey={(p) => p.id}
        csvName="kredi-paketleri"
        columns={[
          { key: "title", header: "Paket", rowHeader: true },
          {
            key: "credits",
            header: "Kredi",
            align: "end",
            sortable: true,
            render: (p) => `${p.credits} + ${p.bonusCredits}`,
          },
          {
            key: "priceTry",
            header: "Fiyat",
            align: "end",
            sortable: true,
            render: (p) => formatTry(p.priceTry),
          },
          { key: "totalPurchases", header: "Satış", align: "end", sortable: true },
          { key: "enabled", header: "Durum", render: (p) => enabledBadge(p.enabled) },
          {
            key: "actions",
            header: "İşlemler",
            render: (p) => (
              <Button variant="secondary" size="sm" onClick={() => setEditing(p)}>
                Düzenle
              </Button>
            ),
          },
        ]}
      />
      <EditDialog
        open={editing !== null}
        title={`Paketi düzenle: ${editing?.title ?? ""}`}
        fields={PACK_FIELDS}
        initial={editing ?? {}}
        confirmDiff
        onClose={() => setEditing(null)}
        onSubmit={async (values, reason) => {
          if (!editing) return;
          await run(
            "creditPacks.update",
            { params: { id: editing.id }, body: { ...values, reason } },
            {
              success: "Paket güncellendi.",
              after: reload,
            },
          );
        }}
      />
    </AreaFrame>
  );
}

const MODULE_LABELS: Record<string, string> = {
  ai_chat: "AI sohbet",
  ai_deep_trip: "Derin çok günlü rota",
  ai_stay_dining: "Konaklama ve gastronomi",
  route_optimize: "Rota optimizasyonu",
};

function CreditStats() {
  const { data, errors, loading, reload } = useAreaData(["creditStats"] as const);
  const s = (data.creditStats?.stats ?? {}) as Record<string, unknown>;
  const byModule = Object.entries((s.byModule ?? {}) as Record<string, number>).map(([k, v]) => ({
    module: MODULE_LABELS[k] ?? k,
    credits: v,
  }));
  return (
    <AreaFrame loading={loading} error={errors.creditStats} onRetry={reload}>
      <div className="admin-stack">
        <KpiGrid
          label="Kredi göstergeleri"
          items={[
            { label: "Verilen kredi", value: formatNumber(s.totalCreditsGranted) },
            { label: "Harcanan kredi", value: formatNumber(s.totalCreditsConsumed) },
            { label: "Kalan kredi", value: formatNumber(s.totalCreditsRemaining) },
            { label: "Etkin cüzdan", value: formatNumber(s.activeWallets) },
            { label: "Kullanıcı başı bakiye", value: formatNumber(s.averageBalancePerUser) },
          ]}
        />
        <Panel title="Modüle göre harcama">
          <RecordTable
            caption="Modüle göre harcama tablosu"
            rows={byModule}
            rowKey={(r) => r.module}
            csvName="kredi-modul"
            columns={[
              { key: "module", header: "Modül", rowHeader: true },
              {
                key: "credits",
                header: "Kredi",
                align: "end",
                sortable: true,
                render: (r) => formatNumber(r.credits),
              },
            ]}
          />
        </Panel>
      </div>
    </AreaFrame>
  );
}

function Stripe() {
  const run = useAdminMutation();
  const [open, setOpen] = useState(false);
  const { data, errors, loading, reload } = useAreaData(["stripeConfig"] as const);
  const s = data.stripeConfig?.stripe;
  return (
    <AreaFrame loading={loading} error={errors.stripeConfig} onRetry={reload}>
      <Panel
        title="Stripe bağlantısı"
        actions={
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Yapılandır
          </Button>
        }
      >
        <DetailList
          items={[
            [
              "Bağlantı",
              s?.connected ? (
                <Badge tone="success">Bağlı</Badge>
              ) : (
                <Badge tone="danger">Bağlı değil</Badge>
              ),
            ],
            [
              "Mod",
              s?.mode === "live" ? "Canlı" : s?.mode === "test" ? "Test" : "Yapılandırılmadı",
            ],
            ["Yayınlanabilir anahtar", s?.publishableKey],
            ["Webhook", s?.webhookConfigured ? "Yapılandırıldı" : "Yok"],
            ["Webhook adresi", s?.webhookUrl],
            ["Son webhook", formatDate(s?.lastWebhookAt)],
            ["Varsayılan para birimi", s?.defaultCurrency?.toUpperCase()],
            ["Vergi", s?.taxEnabled ? "Açık" : "Kapalı"],
            ["Son güncelleme", formatDate(s?.updatedAt)],
          ]}
        />
      </Panel>
      <EditDialog
        open={open}
        title="Stripe yapılandırması"
        tone="danger"
        description="Canlı moda geçiş gerçek ödemeleri etkiler. Gizli anahtar alanları boş bırakılırsa değişmez."
        confirmDiff
        fields={[
          {
            name: "mode",
            label: "Mod",
            type: "select",
            required: true,
            options: [
              { value: "test", label: "Test" },
              { value: "live", label: "Canlı" },
            ],
          },
          { name: "publishableKey", label: "Yayınlanabilir anahtar", maxLength: 200 },
          {
            name: "secretKey",
            label: "Gizli anahtar",
            type: "password",
            omitEmpty: true,
            maxLength: 200,
          },
          {
            name: "webhookSecret",
            label: "Webhook gizli anahtarı",
            type: "password",
            omitEmpty: true,
            maxLength: 200,
          },
          { name: "webhookUrl", label: "Webhook adresi", maxLength: 500 },
          { name: "defaultCurrency", label: "Varsayılan para birimi", maxLength: 3 },
          { name: "taxEnabled", label: "Vergi hesaplaması", type: "checkbox" },
        ]}
        initial={{
          mode: s?.mode === "live" ? "live" : "test",
          publishableKey: s?.publishableKey,
          webhookUrl: s?.webhookUrl,
          defaultCurrency: s?.defaultCurrency,
          taxEnabled: s?.taxEnabled,
        }}
        onClose={() => setOpen(false)}
        onSubmit={async (values, reason) => {
          await run(
            "stripeConfig.update",
            { body: { ...values, reason } },
            {
              success: "Stripe yapılandırması güncellendi.",
              after: reload,
            },
          );
        }}
      />
    </AreaFrame>
  );
}
