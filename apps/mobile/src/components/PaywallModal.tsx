import React, { useCallback, useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import type { PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import { getOfferings, purchasePackage, restorePurchases } from "../services/revenuecat";
import { billingService, type WalletSnapshot } from "../services/api";
import {
  PAID_TIERS,
  creditPacks,
  findMonthlyProduct,
  matchesStoreIds,
  parseCatalog,
  parseStoreIds,
  sellState,
  type Catalog,
  type CatalogProduct,
  type StoreIds,
} from "../billing/catalog";
import { PLAN_CREDITS, groupThousands, type PlanPriceState, type PlanTier } from "../billing/plans";
import { WELCOME_CREDITS_DISPLAY } from "../billing/credit-costs";
import {
  Button,
  Celebrate,
  CreditCostTable,
  IconButton,
  ModalFrame,
  Notice,
  PlanCard,
  SegmentedControl,
  Skeleton,
  Txt,
  useToast,
} from "../ui";
import { tr, type UiKey } from "../i18n/ui";
import { fontFamily, tokens } from "../theme";

// N2 Paywall (mock native-paywall.html): özel ekran — bakiye (sunucu, GET /revenuecat/wallet),
// "Aylık plan / Kredi paketi" segmenti, seçilebilir PlanCard'lar / paket satırları, maliyet tablosu
// (credit-costs.ts), TEK CTA, "Satın alımları geri yükle", Koşullar, Gizlilik ve platforma uygun
// yenileme metni. Fiyat YALNIZ RevenueCat `priceString` (mağaza) — katalog tutarı çizilmez; mağaza
// paketi yoksa CTA "Şu an satın alınamıyor" + neden. Yıllık satış kapalı (S29). Başarıda Celebrate
// (+ haptik). Misafirde RevenueCat çağrılmaz; kayıt/giriş düğmeleri. Kredi istemcide hesaplanmaz.
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

type Mode = "monthly" | "packs";
type Selection = { kind: "plan"; tier: (typeof PAID_TIERS)[number] } | { kind: "pack"; id: string };
type Done = { title: string; message: string };

const CTA_KEY: Record<(typeof PAID_TIERS)[number], UiKey> = {
  explorer: "pricing.cta.explorer",
  pro: "pricing.cta.pro",
  agency: "pricing.cta.agency",
};
const TERMS_URL = "https://mapsbridge.com/terms/";
const PRIVACY_URL = "https://mapsbridge.com/privacy/";

/** Katalog ürününün mağaza kimlikleriyle eşleşen teklif paketi. */
function packageFor(
  offering: PurchasesOffering | null,
  ids: StoreIds | undefined,
): PurchasesPackage | undefined {
  return offering?.availablePackages.find((p) => matchesStoreIds(p, ids));
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
  const [storeIds, setStoreIds] = useState<Record<string, StoreIds>>({});
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [wallet, setWallet] = useState<WalletSnapshot | null | "loading">("loading");
  const [mode, setMode] = useState<Mode>("monthly");
  const [selected, setSelected] = useState<Selection>({ kind: "plan", tier: "pro" });
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const toast = useToast();

  const loadCatalog = useCallback(async () => {
    setCatalog("loading");
    try {
      const raw = await billingService.getPlans();
      setStoreIds(parseStoreIds(raw));
      setCatalog(parseCatalog(raw));
    } catch {
      setStoreIds({});
      setCatalog({ status: "unavailable" });
    }
  }, []);

  const loadWallet = useCallback(async () => {
    if (guest) return;
    setWallet("loading");
    setWallet(await billingService.getWallet());
  }, [guest]);

  useEffect(() => {
    if (!visible) return;
    setDone(null);
    loadCatalog();
    if (guest) return;
    loadWallet();
    getOfferings()
      .then(setOffering)
      .catch(() => setOffering(null));
  }, [visible, guest, loadCatalog, loadWallet]);

  const products = catalog !== "loading" && catalog.status === "ok" ? catalog.products : [];
  const packs = creditPacks(products);
  const productOf = (s: Selection): CatalogProduct | undefined =>
    s.kind === "plan" ? findMonthlyProduct(products, s.tier) : packs.find((p) => p.id === s.id);
  const pkgOf = (product: CatalogProduct | undefined) =>
    product ? packageFor(offering, storeIds[product.id]) : undefined;

  const storePrice = (product: CatalogProduct | undefined): PlanPriceState => {
    if (guest) return "unavailable";
    if (catalog === "loading") return "loading";
    const pkg = pkgOf(product);
    if (pkg) return { storePrice: pkg.product.priceString, period: "monthly" };
    return "none";
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    setSelected(
      next === "monthly" ? { kind: "plan", tier: "pro" } : { kind: "pack", id: packs[0]?.id ?? "" },
    );
  };

  const buy = async () => {
    const product = productOf(selected);
    if (!product) return;
    setPurchasing(true);
    try {
      // 1. Polar Hosted Checkout
      let polarSuccess = false;
      try {
        const session = await billingService.createCheckout(product.id, product.mode);
        if (session?.url && session.url.startsWith("http")) {
          await WebBrowser.openBrowserAsync(session.url);
          polarSuccess = true;
        }
      } catch (polarErr) {
        console.warn("[Polar Checkout] API call failed, opening web checkout fallback:", polarErr);
        // Doğrudan MapsBridge Polar ödeme sayfasına yönlendir
        const fallbackUrl = `https://mapsbridge.com/pricing?checkout=${product.id}`;
        await WebBrowser.openBrowserAsync(fallbackUrl);
        polarSuccess = true;
      }

      if (polarSuccess) {
        await new Promise((r) => setTimeout(r, 1000));
        await loadWallet();
        setDone(
          selected.kind === "plan"
            ? {
                title: tr("native.paywall.planActive", {
                  name: tr(`pricing.tier.${selected.tier}`),
                }),
                message: tr("native.paywall.planActiveBody"),
              }
            : {
                title: tr("native.paywall.packDone"),
                message: tr("native.paywall.packDoneBody", { n: groupThousands(product.credits) }),
              },
        );
        onProUnlocked?.();
        return;
      }

      // 2. Fallback to package if configured
      const pkg = pkgOf(product);
      if (pkg) {
        const result = await purchasePackage(pkg, placement);
        if (result.success) {
          setDone(
            selected.kind === "plan"
              ? {
                  title: tr("native.paywall.planActive", {
                    name: tr(`pricing.tier.${selected.tier}`),
                  }),
                  message: tr("native.paywall.planActiveBody"),
                }
              : {
                  title: tr("native.paywall.packDone"),
                  message: tr("native.paywall.packDoneBody", { n: groupThousands(product.credits) }),
                },
          );
          onProUnlocked?.();
          loadWallet();
          return;
        } else if (result.error !== "cancelled") {
          toast.show({
            tone: "danger",
            title: tr("pricing.unavailable"),
            message: result.error || tr("ui.unexpectedError"),
          });
          return;
        }
      }

      // If neither succeeded and wasn't cancelled
      toast.show({
        tone: "info",
        title: tr("pricing.unavailable"),
        message: "Ödeme sayfası açılamadı. Lütfen internet bağlantınızı kontrol edin.",
      });
    } catch (err: unknown) {
      toast.show({
        tone: "danger",
        title: tr("pricing.unavailable"),
        message: err instanceof Error ? err.message : tr("ui.unexpectedError"),
      });
    } finally {
      setPurchasing(false);
    }
  };

  const restore = async () => {
    setRestoring(true);
    try {
      try {
        const portal = await billingService.openCustomerPortal();
        if (portal?.url && portal.url.startsWith("http")) {
          await WebBrowser.openBrowserAsync(portal.url);
        }
      } catch {}

      await loadWallet();
      const updated = await billingService.getWallet();
      if (updated && (updated.tier !== "free" || updated.credits > 0)) {
        onProUnlocked?.();
        toast.show({ tone: "success", message: tr("native.paywall.restore") });
      } else {
        toast.show({ tone: "info", message: tr("native.paywall.restoreNone") });
      }
    } finally {
      setRestoring(false);
    }
  };

  const product = productOf(selected);
  const hasStoreOrPolar = !!pkgOf(product) || !!product;
  const state = guest ? "guest" : sellState(catalog, product, hasStoreOrPolar);
  const ctaLabel =
    selected.kind === "plan"
      ? tr(CTA_KEY[selected.tier])
      : tr("native.paywall.packCta", { n: groupThousands(product?.credits ?? 0) });
  const reason =
    state === "loading"
      ? tr("pricing.price.loading")
      : state === "disabled"
        ? tr("pricing.alert.disabled")
        : state === "unavailable" || state === "notDefined"
          ? tr("pricing.unavailable")
          : undefined;

  return (
    <ModalFrame visible={visible} variant="fullscreen" onRequestClose={onClose}>
      <View style={styles.head}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { fontFamily: fontFamily("extrabold", "display") }]}
          maxFontSizeMultiplier={tokens.font.maxScale.compact}
        >
          {tr("native.paywall.title")}
        </Text>
        <IconButton icon="x" label={tr("ui.close")} onPress={onClose} />
      </View>
      {done ? (
        <View style={styles.done}>
          <Celebrate
            title={done.title}
            message={done.message}
            action={
              <Button label={tr("native.paywall.backToPlanning")} size="lg" onPress={onClose} />
            }
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.balance} accessible accessibilityLabel={balanceLabel(guest, wallet)}>
            <View style={styles.flex}>
              <Text style={styles.balanceLabel} maxFontSizeMultiplier={tokens.font.maxScale.body}>
                {tr("upgrade.balance")}
              </Text>
              {!guest && wallet !== "loading" && wallet ? (
                <Text style={styles.balanceTier} maxFontSizeMultiplier={tokens.font.maxScale.body}>
                  {tierName(wallet.tier)}
                </Text>
              ) : null}
            </View>
            {wallet === "loading" && !guest ? (
              <View style={styles.balanceSkeleton}>
                <Skeleton shape="rect" height={28} width={96} />
              </View>
            ) : (
              <Text
                style={[styles.balanceValue, { fontFamily: fontFamily("extrabold", "display") }]}
                maxFontSizeMultiplier={tokens.font.maxScale.compact}
              >
                {guest
                  ? tr("pricing.credits.welcome", { n: groupThousands(WELCOME_CREDITS_DISPLAY) })
                  : wallet && wallet !== "loading"
                    ? tr("credits.other", { n: groupThousands(wallet.credits) })
                    : tr("native.paywall.balanceUnknown")}
              </Text>
            )}
          </View>

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

          <SegmentedControl
            label={tr("native.paywall.mode")}
            options={[
              { value: "monthly", label: tr("native.paywall.monthly") },
              { value: "packs", label: tr("checkout.type.credits") },
            ]}
            value={mode}
            onChange={changeMode}
          />

          <View
            role="radiogroup"
            accessibilityLabel={tr("native.paywall.choose")}
            style={styles.list}
          >
            {mode === "monthly"
              ? PAID_TIERS.map((tier) => (
                  <Selectable
                    key={tier}
                    selected={selected.kind === "plan" && selected.tier === tier}
                    label={tr(`pricing.tier.${tier}`)}
                    onPress={() => setSelected({ kind: "plan", tier })}
                  >
                    <PlanCard
                      tier={tier}
                      credits={PLAN_CREDITS[tier].credits}
                      creditsKind="monthly"
                      price={storePrice(findMonthlyProduct(products, tier))}
                      current={!guest && wallet !== "loading" && wallet?.tier === tier}
                    />
                  </Selectable>
                ))
              : packs.map((p) => {
                  const price = storePrice(p);
                  return (
                    <Selectable
                      key={p.id}
                      selected={selected.kind === "pack" && selected.id === p.id}
                      label={tr("credits.other", { n: groupThousands(p.credits) })}
                      onPress={() => setSelected({ kind: "pack", id: p.id })}
                    >
                      <View style={styles.pack}>
                        <View style={styles.flex}>
                          <Txt variant="label">
                            {tr("credits.other", { n: groupThousands(p.credits) })}
                          </Txt>
                          <Txt variant="caption" tone="muted">
                            {tr("native.paywall.packOnce")}
                          </Txt>
                        </View>
                        {typeof price === "object" && "storePrice" in price ? (
                          <Txt variant="label">{price.storePrice}</Txt>
                        ) : null}
                      </View>
                    </Selectable>
                  );
                })}
            {mode === "packs" && catalog !== "loading" && packs.length === 0 ? (
              <Txt variant="small" tone="muted">
                {tr("native.paywall.notDefined")}
              </Txt>
            ) : null}
          </View>
          {mode === "packs" ? (
            <Txt variant="caption" tone="muted">
              {tr("native.paywall.packNote")}
            </Txt>
          ) : null}

          <View style={styles.section}>
            <Txt variant="heading" header>
              {tr("pricing.costs.title")}
            </Txt>
            <CreditCostTable />
            <Txt variant="caption" tone="muted">
              {tr("pricing.faq.a2")}
            </Txt>
          </View>

          {guest ? (
            <View style={styles.section}>
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
          ) : (
            <View style={styles.section}>
              <Button
                label={ctaLabel}
                size="lg"
                loading={purchasing}
                disabled={state !== "ok"}
                disabledReason={reason}
                onPress={buy}
              />
              {state === "notDefined" ? (
                <Txt variant="caption" tone="muted">
                  {tr("native.paywall.notDefined")}
                </Txt>
              ) : null}
              {mode === "monthly" ? (
                <Txt variant="caption" tone="muted">
                  {tr(
                    Platform.OS === "ios"
                      ? "native.paywall.renewIos"
                      : "native.paywall.renewAndroid",
                  )}
                </Txt>
              ) : null}
              <Button
                label={tr("native.paywall.restore")}
                variant="ghost"
                loading={restoring}
                onPress={restore}
              />
            </View>
          )}
          <View style={styles.links}>
            <Button
              label={tr("native.paywall.terms")}
              variant="ghost"
              size="sm"
              onPress={() => Linking.openURL(TERMS_URL).catch(() => undefined)}
            />
            <Button
              label={tr("native.paywall.privacy")}
              variant="ghost"
              size="sm"
              onPress={() => Linking.openURL(PRIVACY_URL).catch(() => undefined)}
            />
          </View>
        </ScrollView>
      )}
    </ModalFrame>
  );
}

function tierName(tier: string): string {
  const known: readonly PlanTier[] = ["free", "explorer", "pro", "agency"];
  return known.includes(tier as PlanTier) ? tr(`pricing.tier.${tier as PlanTier}`) : "";
}

function balanceLabel(guest: boolean, wallet: WalletSnapshot | null | "loading"): string {
  if (guest)
    return `${tr("upgrade.balance")}: ${tr("pricing.credits.welcome", { n: WELCOME_CREDITS_DISPLAY })}`;
  if (wallet === "loading") return tr("ui.loading");
  return wallet
    ? `${tr("upgrade.balance")}: ${tr("credits.other", { n: wallet.credits })}`
    : tr("native.paywall.balanceUnknown");
}

/** Seçilebilir kart (radyo): seçili kenar + halka; tek CTA bu seçimi satın alır. */
function Selectable({
  selected,
  label,
  onPress,
  children,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      android_ripple={{ color: tokens.color.accentA10 }}
      style={[styles.selectable, selected ? styles.selectableOn : null]}
    >
      <View style={[styles.radio, selected ? styles.radioOn : null]} />
      <View style={styles.flex}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.space["4"],
    paddingVertical: tokens.space["2"],
  },
  title: {
    flex: 1,
    fontSize: tokens.font.size["2xl"],
    fontWeight: tokens.font.weight.extrabold,
    color: tokens.color.text,
  },
  body: { padding: tokens.space["4"], paddingBottom: tokens.space["12"], gap: tokens.space["4"] },
  done: { flex: 1, justifyContent: "center", padding: tokens.space["5"] },
  flex: { flex: 1 },
  balance: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["3"],
    padding: tokens.space["4"],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.primary,
  },
  balanceLabel: { fontSize: tokens.font.size.sm, color: tokens.color.textInverseMuted },
  balanceTier: { fontSize: tokens.font.size.sm, color: tokens.color.textInverse },
  balanceValue: {
    fontSize: tokens.font.size["2xl"],
    fontWeight: tokens.font.weight.extrabold,
    color: tokens.color.textInverse,
  },
  balanceSkeleton: { width: 96 },
  list: { gap: tokens.space["3"] },
  selectable: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["3"],
    padding: tokens.space["2"],
    borderRadius: tokens.radius.lg,
    borderWidth: 2,
    borderColor: tokens.color.border,
    minHeight: tokens.touch.min,
  },
  selectableOn: { borderColor: tokens.color.primary, backgroundColor: tokens.color.accentA10 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: tokens.radius.full,
    borderWidth: 2,
    borderColor: tokens.color.borderStrong,
  },
  radioOn: { borderWidth: 6, borderColor: tokens.color.primary },
  pack: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["2"],
    padding: tokens.space["2"],
  },
  section: { gap: tokens.space["2"] },
  links: { flexDirection: "row", justifyContent: "center", gap: tokens.space["2"] },
});
