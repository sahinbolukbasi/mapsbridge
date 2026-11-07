import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Progress, Txt } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";
import {
  CHAT_PHASES,
  THINKING_PHASES,
  currentPhase,
  visiblePhaseCount,
} from "../ui/logic/thinking-phases";
// Asistan bekleme göstergesi (web ThinkingSteps karşılığı, direction §3): gerçek boru hattı
// aşamaları Progress "steps" ile; etkin adım döner, tamamlanan onaylanır. Süre uydurulmaz.
export function ThinkingSteps({ isRoute }: { isRoute: boolean }) {
  const [visible, setVisible] = useState(1);
  useEffect(() => {
    const started = Date.now();
    const timers = THINKING_PHASES.slice(1).map((p) =>
      setTimeout(() => setVisible(visiblePhaseCount(Date.now() - started)), p.delay),
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  const phases = isRoute ? THINKING_PHASES : CHAT_PHASES;
  return (
    <View style={styles.root}>
      <Txt variant="label" tone="brand">
        {tr("studio.think.title")}
      </Txt>
      <Progress
        variant="steps"
        label={tr("studio.think.title")}
        steps={phases.map((p) => ({ id: p.key, label: tr(p.key) }))}
        current={currentPhase(isRoute, visible)}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  root: {
    gap: tokens.space["3"],
    padding: tokens.space["4"],
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
});
