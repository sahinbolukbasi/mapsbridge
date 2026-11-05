import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { fontFamily, tokens } from "../theme";
import { tr } from "../i18n/ui";
import {
  derivePlanEquivalents,
  formatPrice,
  groupThousands,
  type PlanPriceState,
  type PlanTier,
} from "../billing/plans";
import { Button } from "./Button";

// Plan kartı (design §4.2, §7.2; karar S2): web PlanCard ile aynı prop sözlüğü ve metinler.
// Kredi miktarı birincil satır, "≈" satırı maliyet tablosundan türetilir, fiyat yalnızca canlı
// katalogdan (`price`). Popülerlik rozeti ve deneme vaadi YOK (§7.1). Native PaywallModal'da
// (FEAT-012) kullanılır; satın alma bugünkü RevenueCat çağrılarıyla kalır (`cta.onPress`).
export type PlanCta = {
  label: string;
  onPress?: () => void;
  /** Verilirse CTA devre dışıdır; neden metni görünür ve düğmenin ipucudur (design §7.3). */
  disabledReason?: string;
  variant?: "primary" | "secondary";
};

export interface PlanCardProps {
  tier: PlanTier;
  credits: number;
  creditsKind: "welcome" | "monthly" | "yearly";
  price: PlanPriceState;
  discount?: number;
  current?: boolean;
  cta?: PlanCta;
}

export function PlanCard({
  tier,
  credits,
  creditsKind,
  price,
  discount,
  current = false,
  cta,
}: PlanCardProps) {
  const eq = derivePlanEquivalents(credits);
  const name = tr(`pricing.tier.${tier}`);
  const creditsLine = tr(`pricing.credits.${creditsKind}`, { n: groupThousands(credits) });
  const eqLine = tr(eq.deepTrips === 1 ? "pricing.equivalents.oneTrip" : "pricing.equivalents", {
    trips: groupThousands(eq.deepTrips),
    chats: groupThousands(eq.chats),
  });
  return (
    <View style={[styles.card, current ? styles.current : null]}>
      <View style={styles.head}>
        <Text
          accessibilityRole="header"
          style={[styles.name, { fontFamily: fontFamily("bold", "display") }]}
          maxFontSizeMultiplier={tokens.font.maxScale.compact}
        >
          {name}
        </Text>
        {current ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} maxFontSizeMultiplier={tokens.font.maxScale.compact}>
              {tr("pricing.current")}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[styles.credits, { fontFamily: fontFamily("bold") }]}
        maxFontSizeMultiplier={tokens.font.maxScale.body}
      >
        {creditsLine}
      </Text>
      <Text style={styles.muted} maxFontSizeMultiplier={tokens.font.maxScale.body}>
        {eqLine}
      </Text>
      <PriceLine price={price} />
      {discount !== undefined ? (
        <Text style={styles.muted} maxFontSizeMultiplier={tokens.font.maxScale.body}>
          {tr("pricing.period.discount", { n: discount })}
        </Text>
      ) : null}
      {cta ? (
        <View style={styles.cta}>
          <Button
            label={cta.label}
            variant={cta.variant ?? "primary"}
            disabled={!!cta.disabledReason}
            hint={cta.disabledReason}
            onPress={cta.onPress}
          />
          {cta.disabledReason ? (
            <Text style={styles.muted} maxFontSizeMultiplier={tokens.font.maxScale.body}>
              {cta.disabledReason}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function PriceLine({ price }: { price: PlanPriceState }) {
  if (price === "none") return null;
  if (price === "loading")
    return (
      <View style={styles.loading} accessible accessibilityLabel={tr("pricing.price.loading")}>
        <ActivityIndicator size="small" color={tokens.color.textMuted} />
      </View>
    );
  if (price === "unavailable")
    return (
      <Text style={styles.muted} maxFontSizeMultiplier={tokens.font.maxScale.body}>
        {tr("pricing.price.atCheckout")}
      </Text>
    );
  const text =
    price === "free"
      ? tr("pricing.price.free")
      : tr(price.period === "yearly" ? "pricing.price.yearly" : "pricing.price.monthly", {
          price: formatPrice(price.amount),
        });
  return (
    <Text
      style={[styles.price, { fontFamily: fontFamily("semibold") }]}
      maxFontSizeMultiplier={tokens.font.maxScale.body}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.space["2"],
    padding: tokens.space["4"],
    borderWidth: 1,
    borderColor: tokens.color.cardBorder,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.cardBg,
  },
  current: { borderColor: tokens.color.stopSelectedBorder, borderWidth: 2 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: {
    flex: 1,
    fontSize: tokens.font.size.xl,
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.text,
  },
  badge: {
    paddingHorizontal: tokens.space["2"],
    paddingVertical: 2,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.badgeSuccessBg,
  },
  badgeText: {
    fontSize: tokens.font.size.xs,
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.badgeSuccessFg,
  },
  credits: {
    fontSize: tokens.font.size.lg,
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.text,
  },
  muted: { fontSize: tokens.font.size.sm, color: tokens.color.textMuted },
  price: {
    fontSize: tokens.font.size.base,
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  loading: { alignItems: "flex-start", minHeight: tokens.space["5"] },
  cta: { gap: tokens.space["1"], marginTop: tokens.space["2"] },
});
