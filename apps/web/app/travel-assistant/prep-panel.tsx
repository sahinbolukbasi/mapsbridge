"use client";
import type { ReactNode } from "react";
import { getStoredSession } from "../lib/cognito";
import type { UnifiedRoutePlan } from "../lib/ai/types";
import { useLocale } from "../lib/locale-context";
import { Section } from "../components/ui";
import { TravelAffiliateCards, InlineAffiliateStrip } from "./travel-affiliate-cards";
import type { PrepContext } from "./prep-context";

/**
 * I8 (design §9.1): affiliate yüzeylerinin TEK render yeri. Rota önerisi ve sohbet akışı
 * içinde değil, taslak panelinin Hazırlık bölümünde yaşar. kind "none" → hiçbir şey (I10).
 */
export function PrepPanel({
  context,
  flightBlock,
}: {
  context: PrepContext<UnifiedRoutePlan>;
  flightBlock?: ReactNode;
}) {
  const { t } = useLocale();
  if (context.kind === "route") {
    return (
      <>
        {flightBlock}
        <Section title={t("ai.prepAffiliateTitle", "Rezervasyon seçenekleri")} level={3}>
          <TravelAffiliateCards route={context.route} />
        </Section>
      </>
    );
  }
  if (context.kind === "strip") {
    const token = getStoredSession()?.token;
    return (
      <Section title={t("ai.prepTab", "✈ Hazırlık")}>
        <InlineAffiliateStrip
          destination={context.destination}
          messageText={context.messageText}
          authToken={token || undefined}
        />
      </Section>
    );
  }
  return flightBlock ? <>{flightBlock}</> : null;
}
