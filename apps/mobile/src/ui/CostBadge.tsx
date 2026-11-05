import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fontFamily, tokens } from "../theme";
import { formatCreditCost, type CreditCost } from "../billing/credit-costs";
import { Icon } from "./Icon";

// Kredi maliyeti etiketi (design §4.2): "1 kredi" / "Ücretsiz". Metin olarak okunur, ikon
// dekoratif. Yalnızca gösterim; kredi sunucuda düşer.
export interface CostBadgeProps {
  cost: CreditCost;
}

export function CostBadge({ cost }: CostBadgeProps) {
  return (
    <View style={styles.badge}>
      <Icon name="coin" size={16} color={tokens.color.costFg} />
      <Text
        style={[styles.text, { fontFamily: fontFamily("semibold") }]}
        maxFontSizeMultiplier={tokens.font.maxScale.compact}
      >
        {formatCreditCost(cost)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: tokens.space["1"],
    paddingHorizontal: tokens.space["2"],
    paddingVertical: 2,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.costBg,
  },
  text: {
    color: tokens.color.costFg,
    fontSize: tokens.font.size.xs,
    fontWeight: tokens.font.weight.semibold,
  },
});
