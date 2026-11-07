import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, ModalFrame, Txt } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";
import { ThinkingSteps } from "./ThinkingSteps";

// Rota oluşturulurken gösterilen bekleme kartı (FEAT-012: primitive'lerle yeniden yazıldı).
// Yüzde ya da "ROTA MOTORU 4.2" gibi uydurma metin yoktur (I1); adımlar gerçek boru hattı
// aşamalarıdır (ThinkingSteps, web ile aynı), yalnızca istek sürerken görünür. "Arka planda devam et" kartı kapatır,
// istek sürer ve yanıt sohbette görünür. Kredi sunucuda ayrılır; istemci hesaplamaz.
interface RouteLoadingModalProps {
  visible: boolean;
  onRunInBackground?: () => void;
  routeTitle?: string;
}

export function RouteLoadingModal({
  visible,
  onRunInBackground,
  routeTitle = tr("guest.summary.create"),
}: RouteLoadingModalProps) {
  return (
    <ModalFrame
      visible={visible}
      variant="dialog"
      title={routeTitle}
      onRequestClose={onRunInBackground}
      dismissible={Boolean(onRunInBackground)}
    >
      <View style={styles.card} accessibilityLiveRegion="polite">
        <Txt variant="heading" header align="center">
          {routeTitle}
        </Txt>
        <ThinkingSteps isRoute />
        <Txt variant="caption" tone="muted" align="center">
          {tr("upgrade.note")}
        </Txt>
        {onRunInBackground ? (
          <Button
            label={tr("native.routeLoading.background")}
            variant="secondary"
            onPress={onRunInBackground}
          />
        ) : null}
      </View>
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 380,
    alignItems: "stretch",
    gap: tokens.space["3"],
    padding: tokens.space["6"],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.modalBg,
  },
});
