import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import type { PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import { getOfferings, purchasePackage, restorePurchases } from "../services/revenuecat";
import { billingService } from "../services/api";
import { findMonthlyProduct, parseCatalog, type Catalog } from "../billing/catalog";
import { PLAN_CREDITS, PLAN_TIERS, type PlanPriceState, type PlanTier } from "../billing/plans";
import { Button, CreditCostTable, ModalFrame, Notice, PlanCard, Txt, type PlanCta } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";

// Native Planlar / Paywall (design §7, §9 "Planlar/Paywall"; kararlar S2, S6, S18): web /pricing/
// ile aynı 4 PlanCard (Gezgin 5 hoş geldin, Kaşif 100/ay, Pro Kaşif 500/ay, Tur Lideri 2500/ay) ve
// aynı CreditCostTable. Fiyat YALNIZCA canlı katalogdan (GET /revenuecat/plans); yükleniyor /
// yüklenemedi / satın alma kapalı / ürün yok durumları web §7.3 ile aynı. "EN POPÜLER", deneme ya da
// "kredi kartı gerekmez" yok. Native yalnız AYLIK abonelik sunar (S18). Satın alma bugünkü
// services/revenuecat.ts çağrılarıyla (getOfferings → purchasePackage / restorePurchases); kart,
// mağaza teklifinde katalog ürün kimliğiyle eşleşen paket varsa satın alınabilir, yoksa CTA
// "Şu an satın alınamıyor" olur. Misafirde (`guest`) RevenueCat çağrılmaz; kartlar bilgi amaçlıdır
// ve kayıt/giriş düğmeleri gösterilir.
// ⚠ UI hoş geldin 5 / ai_chat 1 gösterir; sunucu değeri yayından önce kullanıcı tarafından teyit
// edilmeli.
interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  /** Başarılı satın alma ya da geri yükleme sonrası. */
  onProUnlocked?: () => void;
  /** Dönüşüm ölçümü için paywall yerleşim adı (ör. "profile", "assistant_credits"). */
  placement?: string;
  /** Oturumsuz: satın alma yok, kimlik düğmeleri. */
  guest?: boolean;
  onRequireAuth?: (mode: "register" | "login") => void;
}

const CTA_KEY: Record<Exclude<PlanTier, "free">, Parameters<typeof tr>[0]> = {
  explorer: "pricing.cta.explorer",
  pro: "pricing.cta.pro",
  agency: "pricing.cta.agency",
};

/** Mağaza paketinin ürün kimliği katalog ürün kimliğine eşit mi (eşleme varsayımı, bkz. üst not). */
function packageFor(
  offering: PurchasesOffering | null,
  productId: string,
): PurchasesPackage | undefined {
  return offering?.availablePackages.find(
    (p) => p.product.identifier === productId || p.identifier === productId,
  );
}

export function PaywallModal({
  visible,
  onClose,
  onProUnlocked,
  placement,
  guest = false,
  onRequireAuth,
}: PaywallModalProps) {
  const [catalog, setCatalog] = useState<Catalog | "loading">("loading");
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [purchasing, setPurchasing] = useState<PlanTier | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadCatalog = useCallback(async () => {
    setCatalog("loading");
    try {
      setCatalog(parseCatalog(await billingService.getPlans()));
    } catch {
      setCatalog({ status: "unavailable" });
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    loadCatalog();
    if (guest) return;
    getOfferings()
      .then(setOffering)
      .catch(() => setOffering(null));
  }, [visible, guest, loadCatalog]);

  const buy = async (tier: PlanTier, pkg: PurchasesPackage) => {
    setPurchasing(tier);
    try {
      const result = await purchasePackage(pkg, placement);
      if (result.success) {
        onProUnlocked?.();
        onClose();
      } else if (result.error !== "cancelled") {
        Alert.alert(tr("pricing.unavailable"), result.error || tr("ui.unexpectedError"));
      }
    } finally {
      setPurchasing(null);
    }
  };

  const restore = async () => {
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.isPro) {
        onProUnlocked?.();
        onClose();
      } else {
        Alert.alert("Geri yüklenecek abonelik bulunamadı", result.error ?? "");
      }
    } finally {
      setRestoring(false);
    }
  };

  const priceOf = (tier: PlanTier): PlanPriceState => {
    if (tier === "free") return "free";
    if (catalog === "loading") return "loading";
    if (catalog.status === "unavailable") return "unavailable";
    const product = findMonthlyProduct(catalog.products, tier);
    return product
      ? { amount: product.amount, period: "monthly", credits: product.credits }
      : "none";
  };

  const ctaOf = (tier: PlanTier): PlanCta | undefined => {
    if (guest || tier === "free") return undefined;
    const label = tr(CTA_KEY[tier]);
    if (catalog === "loading") return { label, disabledReason: tr("pricing.price.loading") };
    if (catalog.status === "unavailable")
      return { label, disabledReason: tr("pricing.unavailable") };
    if (!catalog.enabled) return { label, disabledReason: tr("pricing.alert.disabled") };
    const product = findMonthlyProduct(catalog.products, tier);
    const pkg = product?.available ? packageFor(offering, product.id) : undefined;
    if (!pkg) return { label, disabledReason: tr("pricing.unavailable") };
    return {
      label: purchasing === tier ? tr("ui.loading") : label,
      onPress: purchasing ? undefined : () => buy(tier, pkg),
    };
  };

  return (
    <ModalFrame
      visible={visible}
      variant="sheet"
      title={tr("profile.plans")}
      onRequestClose={onClose}
    >
      <ScrollView contentContainerStyle={styles.body}>
        <Txt tone="muted">{tr("upgrade.note")}</Txt>
        {catalog !== "loading" && catalog.status === "unavailable" ? (
          <Notice
            tone="info"
            title={tr("pricing.alert.failed")}
            action={{ label: tr("pricing.alert.retry"), onPress: loadCatalog }}
          />
        ) : null}
        {catalog !== "loading" && catalog.status === "ok" && !catalog.enabled ? (
          <Notice tone="warning" title={tr("pricing.alert.disabled")} />
        ) : null}
        {PLAN_TIERS.map((tier) => (
          <PlanCard
            key={tier}
            tier={tier}
            credits={PLAN_CREDITS[tier].credits}
            creditsKind={PLAN_CREDITS[tier].kind}
            price={priceOf(tier)}
            cta={ctaOf(tier)}
          />
        ))}
        {guest ? (
          <View style={styles.actions}>
            <Button
              label={tr("gate.register")}
              size="lg"
              onPress={() => {
                onClose();
                onRequireAuth?.("register");
              }}
            />
            <Button
              label={tr("gate.login")}
              variant="secondary"
              size="lg"
              onPress={() => {
                onClose();
                onRequireAuth?.("login");
              }}
            />
          </View>
        ) : null}
        <View style={styles.section}>
          <Txt variant="heading" header>
            {tr("pricing.costs.title")}
          </Txt>
          <CreditCostTable />
          <Txt variant="small" tone="muted">
            {tr("pricing.costs.free")}
          </Txt>
        </View>
        <View style={styles.section}>
          <Txt variant="heading" header>
            {tr("pricing.independence.title")}
          </Txt>
          <Txt variant="small" tone="muted">
            {tr("pricing.independence.body")}
          </Txt>
          <Txt variant="caption" tone="muted">
            {tr("pricing.note.payment")}
          </Txt>
        </View>
        {!guest ? (
          <Button
            label="Satın alımları geri yükle"
            variant="ghost"
            loading={restoring}
            onPress={restore}
          />
        ) : null}
      </ScrollView>
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: tokens.space["5"],
    paddingBottom: tokens.space["12"],
    gap: tokens.space["4"],
  },
  actions: { gap: tokens.space["2"] },
  section: { gap: tokens.space["2"] },
});
