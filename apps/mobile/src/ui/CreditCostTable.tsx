import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fontFamily, tokens } from "../theme";
import {
  CREDIT_COST_ROWS,
  formatCreditCost,
  type CreditCostAction,
  type CreditCostRow,
} from "../billing/credit-costs";
import { CostBadge } from "./CostBadge";
import { tr } from "../i18n/ui";

// Tek kredi tablosu (design §4.2, §7.4, F58): web CreditCostTable ile aynı satırlar
// (billing/credit-costs.ts, parite testli). RN liste: her satır "İşlem, maliyet" olarak tek
// parça okunur; `caption` görünmez, listenin erişilebilir adıdır. `actions` alt kümeyi seçer.
export interface CreditCostTableProps {
  caption?: string;
  actions?: readonly CreditCostAction[];
}

export function CreditCostTable({
  caption = tr("credits.table.caption"),
  actions,
}: CreditCostTableProps) {
  const rows: CreditCostRow[] = CREDIT_COST_ROWS.filter(
    (row) => !actions || actions.includes(row.action),
  );
  return (
    <View style={styles.table} accessibilityRole="list" accessibilityLabel={caption}>
      {rows.map((row, i) => (
        <View
          key={row.action}
          style={[styles.row, i > 0 ? styles.divider : null]}
          accessible
          accessibilityLabel={`${row.label}, ${formatCreditCost(row.cost)}`}
        >
          <Text
            style={[styles.label, { fontFamily: fontFamily("regular") }]}
            maxFontSizeMultiplier={tokens.font.maxScale.body}
          >
            {row.label}
          </Text>
          <CostBadge cost={row.cost} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: tokens.color.tableBorder,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.tableBg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space["3"],
    minHeight: tokens.touch.min,
    paddingHorizontal: tokens.space["3"],
    paddingVertical: tokens.space["2"],
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.color.tableBorder },
  label: { flex: 1, color: tokens.color.tableFg, fontSize: tokens.font.size.md },
});
