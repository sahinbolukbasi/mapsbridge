import React, { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Icon, ModalFrame, Txt } from "../ui";
import { tokens } from "../theme";
import { shakeDetector } from "../services/shakeEmergency";

export function EmergencyModal() {
  const [active, setActive] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    void shakeDetector.init();
    const unsub = shakeDetector.subscribe(() => {
      setCountdown(5);
      setActive(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!active) return;
    if (countdown <= 0) {
      setActive(false);
      // Ek onay sormadan derhal acil arama başlat
      void Linking.openURL("tel:112");
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((c) => c - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [active, countdown]);

  if (!active) return null;

  return (
    <ModalFrame
      visible={active}
      variant="dialog"
      title="Acil Durum Uyarısı"
      onRequestClose={() => setActive(false)}
    >
      <View style={styles.dialog}>
        <View style={styles.iconWrapper}>
          <Icon name="alert" size={32} color={tokens.color.onPrimary} />
        </View>

        <Txt variant="heading" header align="center" style={styles.title}>
          Acil Durum Uyarısı!
        </Txt>

        <Txt variant="body" align="center" style={styles.bodyText}>
          Telefon sallandı. Bulunduğunuz konuma göre acil durum hattı (112) aranacak.
        </Txt>

        <View style={styles.counterCircle}>
          <Text style={styles.counterText}>{countdown}</Text>
        </View>

        <Txt variant="caption" tone="muted" align="center">
          Aramayı durdurmak için aşağıdaki butona basın
        </Txt>

        <Button
          label="İptal Et"
          variant="secondary"
          size="lg"
          onPress={() => setActive(false)}
        />
      </View>
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  dialog: {
    padding: tokens.space["4"],
    alignItems: "center",
    gap: tokens.space["3"],
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.color.danger,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: tokens.space["1"],
  },
  title: {
    fontSize: 20,
    color: tokens.color.danger,
  },
  bodyText: {
    color: tokens.color.text,
  },
  counterCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: tokens.color.danger,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: tokens.space["2"],
  },
  counterText: {
    fontSize: 40,
    fontWeight: "bold",
    color: tokens.color.danger,
  },
});
