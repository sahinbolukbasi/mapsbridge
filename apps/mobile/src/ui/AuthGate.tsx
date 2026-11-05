import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { fontFamily, tokens } from "../theme";
import { tr } from "../i18n/ui";
import { WELCOME_CREDITS_DISPLAY } from "../billing/credit-costs";
import { Button } from "./Button";
import { CreditCostTable } from "./CreditCostTable";
import { Icon } from "./Icon";
import { ModalFrame } from "./ModalFrame";
import { Screen } from "./Screen";

// Tek kimlik kapısı (design §4.2, §6.5, F18, R7): web AuthGate ile aynı prop sözlüğü, metinler
// ve sıra: birincil "Ücretsiz hesap aç", ikincil "Giriş yap", üçüncül "Şimdilik devam et".
// - page: ekranın yerine kendi Screen'ini çizer (sekme kökü, ör. oturumsuz Mesajlar).
// - sheet: ModalFrame (bottomSheet; accessibilityViewIsModal, Android geri = "Şimdilik devam et").
// Native'de URL yok: `next` yerine onRegister/onLogin geri çağrıları AuthScreen'i açar.
// Kredi bilgisi yalnızca gösterimdir; istemci kredi hesaplamaz ya da düşmez.
// ⚠ UI hoş geldin 5 / ai_chat 1 gösterir; sunucu değeri yayından önce kullanıcı tarafından
// teyit edilmeli.
export type AuthGateReason = "save" | "ai" | "messages" | "profile";

export interface AuthGateProps {
  variant: "page" | "sheet";
  reason: AuthGateReason;
  /** Misafir yanıtları cihazda saklandı (design §6.5 notu). */
  draft?: boolean;
  /** sheet: açık mı. */
  visible?: boolean;
  /** sheet: "Şimdilik devam et" ve Android geri. page: verilirse üçüncül düğme görünür. */
  onClose?: () => void;
  onRegister: () => void;
  onLogin: () => void;
}

function GateContent({
  reason,
  draft,
  onClose,
  onRegister,
  onLogin,
}: Omit<AuthGateProps, "variant" | "visible">) {
  return (
    <View style={styles.content}>
      <Text style={styles.body} maxFontSizeMultiplier={tokens.font.maxScale.body}>
        {tr(`gate.body.${reason}`)}
      </Text>
      {draft ? (
        <Text style={styles.draft} maxFontSizeMultiplier={tokens.font.maxScale.body}>
          {tr("gate.draftNote")}
        </Text>
      ) : null}
      <View style={styles.perks}>
        <Perk text={tr("gate.welcome", { n: WELCOME_CREDITS_DISPLAY })} />
        {reason === "ai" ? <Perk text={tr("gate.serverCredits")} /> : null}
      </View>
      {reason === "ai" ? (
        <CreditCostTable caption={tr("gate.costs.caption")} actions={["ai_deep_trip"]} />
      ) : null}
      <View style={styles.actions}>
        <Button label={tr("gate.register")} variant="primary" size="lg" onPress={onRegister} />
        <Button label={tr("gate.login")} variant="secondary" size="lg" onPress={onLogin} />
        {onClose ? <Button label={tr("gate.continue")} variant="ghost" onPress={onClose} /> : null}
      </View>
    </View>
  );
}

function Perk({ text }: { text: string }) {
  return (
    <View style={styles.perk}>
      <Icon name="check" size={20} color={tokens.color.success} />
      <Text style={styles.perkText} maxFontSizeMultiplier={tokens.font.maxScale.body}>
        {text}
      </Text>
    </View>
  );
}

function GateHead({ reason }: { reason: AuthGateReason }) {
  return (
    <View style={styles.head}>
      <Text style={styles.eyebrow} maxFontSizeMultiplier={tokens.font.maxScale.compact}>
        {tr("gate.eyebrow")}
      </Text>
      <Text
        accessibilityRole="header"
        style={[styles.title, { fontFamily: fontFamily("extrabold", "display") }]}
        maxFontSizeMultiplier={tokens.font.maxScale.compact}
      >
        {tr(`gate.title.${reason}`)}
      </Text>
    </View>
  );
}

export function AuthGate({ variant, reason, draft, visible = false, ...actions }: AuthGateProps) {
  if (variant === "page") {
    return (
      <Screen scroll>
        <View style={styles.page}>
          <GateHead reason={reason} />
          <GateContent reason={reason} draft={draft} {...actions} />
        </View>
      </Screen>
    );
  }
  const close = actions.onClose ?? (() => undefined);
  return (
    <ModalFrame
      visible={visible}
      variant="bottomSheet"
      title={tr(`gate.title.${reason}`)}
      onRequestClose={close}
    >
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.sheetBody}>
          <GateHead reason={reason} />
          <GateContent reason={reason} draft={draft} {...actions} onClose={close} />
        </ScrollView>
      </View>
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  page: { padding: tokens.space["5"], gap: tokens.space["4"] },
  sheet: {
    maxHeight: "90%",
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    backgroundColor: tokens.color.sheetBg,
  },
  // Alt boşluk: overlay modal SafeArea taşımaz, ana ekran çubuğunun altında kalmasın.
  sheetBody: {
    padding: tokens.space["5"],
    paddingBottom: tokens.space["10"],
    gap: tokens.space["4"],
  },
  head: { gap: tokens.space["1"] },
  eyebrow: {
    fontSize: tokens.font.size.xs,
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.highlightText,
  },
  title: {
    fontSize: tokens.font.size["2xl"],
    fontWeight: tokens.font.weight.extrabold,
    color: tokens.color.text,
  },
  content: { gap: tokens.space["4"] },
  body: { fontSize: tokens.font.size.base, color: tokens.color.textMuted },
  draft: { fontSize: tokens.font.size.sm, color: tokens.color.text },
  perks: { gap: tokens.space["2"] },
  perk: { flexDirection: "row", alignItems: "center", gap: tokens.space["2"] },
  perkText: { flex: 1, fontSize: tokens.font.size.md, color: tokens.color.text },
  actions: { gap: tokens.space["2"] },
});
