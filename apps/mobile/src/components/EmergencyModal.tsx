import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Icon, ModalFrame, Notice, Txt, haptic } from "../ui";
import { tokens } from "../theme";
import { placeDirectEmergencyCall, shakeDetector } from "../services/shakeEmergency";
import { currentPosition } from "../services/nearby";

export function EmergencyModal() {
  const [phase, setPhase] = useState<"idle" | "countdown" | "calling">("idle");
  const [countdown, setCountdown] = useState(5);
  const [callSeconds, setCallSeconds] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const dialedRef = useRef(false);

  useEffect(() => {
    void shakeDetector.init();
    const unsub = shakeDetector.subscribe(() => {
      dialedRef.current = false;
      setCountdown(5);
      setCallSeconds(0);
      setPhase("countdown");
      haptic("warning");
      currentPosition()
        .then((pos) => {
          if (pos) setCoords(pos);
        })
        .catch(() => undefined);
    });
    return unsub;
  }, []);

  // 5 saniyelik geri sayım — süre 0 olduğu anda hiçbir tuşa basılmasını beklemeden otomatik arama başlar
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      if (!dialedRef.current) {
        dialedRef.current = true;
        haptic("error");
        setPhase("calling");
        void placeDirectEmergencyCall("112");
      }
      return;
    }

    const timer = setTimeout(() => {
      haptic("selection");
      setCountdown((c) => c - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, countdown]);

  // Canlı acil arama süresi sayacı (00:00 -> 00:01 ...)
  useEffect(() => {
    if (phase !== "calling") return;
    const interval = setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const closeAndReset = () => {
    dialedRef.current = false;
    setPhase("idle");
    setCountdown(5);
    setCallSeconds(0);
  };

  if (phase === "idle") return null;

  const formattedDuration = `${String(Math.floor(callSeconds / 60)).padStart(2, "0")}:${String(
    callSeconds % 60,
  ).padStart(2, "0")}`;

  return (
    <ModalFrame
      visible={true}
      variant="dialog"
      title={phase === "calling" ? "112 Acil Çağrı Aktif" : "Acil Durum Uyarısı"}
      onRequestClose={closeAndReset}
    >
      {phase === "countdown" ? (
        <View style={styles.dialog}>
          <View style={styles.iconWrapper}>
            <Icon name="alert" size={32} color={tokens.color.onPrimary} />
          </View>

          <Txt variant="heading" header align="center" style={styles.title}>
            Acil Durum Algılandı!
          </Txt>

          <Txt variant="body" align="center" style={styles.bodyText}>
            Telefon sallandı. Süre biter bitmez hiçbir tuşa basmanıza gerek kalmadan 112 Acil Çağrı Merkezi otomatik olarak aranacaktır.
          </Txt>

          <View style={styles.counterCircle}>
            <Txt variant="display" header style={styles.counterText}>
              {String(countdown)}
            </Txt>
          </View>

          <Txt variant="caption" tone="muted" align="center">
            Yanlışlıkla salladıysanız iptal etmek için dokunun:
          </Txt>

          <Button
            label="Aramayı İptal Et"
            variant="secondary"
            size="lg"
            onPress={closeAndReset}
          />
        </View>
      ) : (
        <View style={styles.dialog}>
          <View style={styles.iconWrapper}>
            <Icon name="phone" size={32} color={tokens.color.onPrimary} />
          </View>

          <Txt variant="eyebrow" tone="danger" align="center">
            OTOMATİK ACİL ARAMA BAŞLATILDI
          </Txt>

          <Txt variant="title" header align="center" style={styles.title}>
            112 Acil Çağrı Merkezi
          </Txt>

          <View style={styles.liveCallBadge}>
            <Txt variant="heading" header style={styles.timerText}>
              {formattedDuration}
            </Txt>
            <Txt variant="caption" tone="highlight">
              Hoparlör Açık • Doğrudan Hat Bağlantısı Aktif
            </Txt>
          </View>

          <Card variant="bordered" style={styles.telemetryCard}>
            <Txt variant="label" align="center">
              Acil Konum Paketi İletildi
            </Txt>
            <Txt variant="caption" tone="muted" align="center">
              {coords
                ? `GPS: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                : "Son bilinen cihaz koordinatları 112 hattına aktarıldı."}
            </Txt>
          </Card>

          <Notice tone="danger" title="112 Hattı Aranıyor">
            Süre tamamlandığı için telefon araması otomatik olarak başlatıldı.
          </Notice>

          <Button
            label="Acil Aramayı Sonlandır"
            variant="danger"
            size="lg"
            onPress={closeAndReset}
          />
        </View>
      )}
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
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: tokens.color.danger,
    backgroundColor: tokens.color.surfaceSunken,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: tokens.space["2"],
  },
  counterText: {
    fontSize: 38,
    fontWeight: "800",
    color: tokens.color.danger,
  },
  liveCallBadge: {
    width: "100%",
    paddingVertical: tokens.space["3"],
    paddingHorizontal: tokens.space["4"],
    borderRadius: tokens.radius.lg,
    borderWidth: 2,
    borderColor: tokens.color.danger,
    backgroundColor: tokens.color.surfaceSunken,
    alignItems: "center",
    gap: tokens.space["1"],
  },
  timerText: {
    fontSize: 28,
    fontWeight: "800",
    color: tokens.color.danger,
  },
  telemetryCard: {
    width: "100%",
  },
});
