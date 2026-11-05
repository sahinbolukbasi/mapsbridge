"use client";
import { useLocale } from "../../lib/locale-context";
import {
  CREDIT_COST_ROWS,
  type CreditCostAction,
  type CreditCostRow,
} from "../../lib/billing/credit-costs";
import { CostBadge } from "./cost-badge";
import { Table } from "./table";
import "./ui.css";
/**
 * Tek kredi tablosu (design §4.2, §7.4, F58): ana sayfa, fiyat, kapılar ve upgrade yüzeyi.
 * Veri lib/billing/credit-costs.ts'ten; `actions` alt kümeyi seçer. <caption> görsel olarak gizli.
 */
export function CreditCostTable({
  caption,
  actions,
}: {
  caption?: string;
  actions?: readonly CreditCostAction[];
}) {
  const { t } = useLocale();
  const rows: CreditCostRow[] = CREDIT_COST_ROWS.filter(
    (row) => !actions || actions.includes(row.action),
  );
  return (
    <Table<CreditCostRow>
      caption={caption ?? t("credits.table.caption", "Kredi maliyetleri")}
      captionHidden
      rows={rows}
      rowKey={(row) => row.action}
      columns={[
        {
          key: "action",
          header: t("credits.table.action", "İşlem"),
          rowHeader: true,
          render: (row) => t(row.labelKey),
        },
        {
          key: "cost",
          header: t("credits.table.cost", "Kredi"),
          align: "end",
          render: (row) => <CostBadge cost={row.cost} />,
        },
      ]}
    />
  );
}
