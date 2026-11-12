import React, { useEffect, useState } from "react";
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon, Txt } from "../ui";
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
      // Initiate emergency call
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
    <Modal visible={active} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.iconWrapper}>
            <Icon name="alert" size={32} color="#ffffff" />
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

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.cancelBtn}
            onPress={() => setActive(false)}
          >
            <Text style={styles.cancelText}>İptal Et</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: tokens.space["4"],
  },
  dialog: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.xl,
    padding: tokens.space["5"],
    alignItems: "center",
    gap: tokens.space["3"],
    ...tokens.shadow.lg,
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
    fontWeight: "800",
    color: tokens.color.danger,
  },
  bodyText: {
    color: tokens.color.text,
  },
  counterCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: tokens.color.danger,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: tokens.space["2"],
  },
  counterText: {
    fontSize: 34,
    fontWeight: "800",
    color: tokens.color.danger,
  },
  cancelBtn: {
    width: "100%",
    backgroundColor: tokens.color.borderStrong,
    paddingVertical: tokens.space["3"],
    borderRadius: tokens.radius.lg,
    alignItems: "center",
    marginTop: tokens.space["2"],
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "700",
    color: tokens.color.text,
  },
});
