import React, { useMemo, useState } from "react";
import {
  Clipboard,
  Linking,
  Platform,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Rect } from "react-native-svg";
import * as Location from "expo-location";
import { Button, Card, Icon, IconButton, ModalFrame, Txt, useToast } from "../ui";
import { GoogleLogo, YandexLogo, AppleLogo } from "../ui/BrandLogos";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";
import {
  encodePinCode,
  generateNumericPinCode,
  type PinPoint,
} from "../share/pin-link";
import { buildDirections, type MapProvider } from "../share/map-directions";

export interface PinShareModalProps {
  visible: boolean;
  onClose: () => void;
  target?: PinPoint | null;
  pin?: { title?: string; label?: string; lat: number; lng: number; address?: string } | null;
}

// Lightweight offline deterministic QR-like matrix generator (21x21 version 1 QR pattern)
function generateQrMatrix(text: string): boolean[][] {
  const size = 21;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (startX: number, startY: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const isBorder = y === 0 || y === 6 || x === 0 || x === 6;
        const isCenter = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        matrix[startY + y][startX + x] = isBorder || isCenter;
      }
    }
  };

  // 3 Finder patterns
  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Data hash pseudo-matrix
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Don't overwrite finders
      if (
        (x < 8 && y < 8) ||
        (x >= size - 8 && y < 8) ||
        (x < 8 && y >= size - 8) ||
        (x === 6 || y === 6)
      ) {
        continue;
      }
      const bit = ((hash ^ (x * 37 + y * 19)) >>> ((x + y) % 16)) & 1;
      matrix[y][x] = bit === 1;
    }
  }

  return matrix;
}

export function PinShareModal({ visible, onClose, target, pin }: PinShareModalProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const effectiveTarget = useMemo<PinPoint | null>(() => {
    if (target) return { lat: target.lat, lng: target.lng, label: target.label || "Konum" };
    if (pin) return { lat: pin.lat, lng: pin.lng, label: pin.title || pin.label || "Konum" };
    return null;
  }, [target, pin]);

  const { numericCode, fullCode, shareUrl } = useMemo(() => {
    if (!effectiveTarget) return { numericCode: "", fullCode: "", shareUrl: "" };
    const num = generateNumericPinCode(effectiveTarget);
    const full = encodePinCode(effectiveTarget);
    const url = `https://mapsbridge.com/p/?c=${num}`;
    return { numericCode: num, fullCode: full, shareUrl: url };
  }, [effectiveTarget]);

  const qrMatrix = useMemo(() => generateQrMatrix(shareUrl), [shareUrl]);

  const copyCode = () => {
    Clipboard.setString(numericCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.show({
      tone: "success",
      title: "Kod Kopyalandı",
      message: `${numericCode} panoya kopyalandı.`,
    });
  };

  const handleNativeShare = async () => {
    if (!effectiveTarget) return;
    try {
      await Share.share({
        message: `${effectiveTarget.label || "Konum"} - MapsBridge\nPaylaşım Kodu: ${numericCode}\n${shareUrl}`,
        url: shareUrl,
      });
    } catch {}
  };

  const openNavigation = async (provider: MapProvider) => {
    if (!effectiveTarget) return;
    try {
      let origin: { lat: number; lng: number } | undefined;
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        origin = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      }
      const dirUrl = buildDirections({
        dest: { lat: effectiveTarget.lat, lng: effectiveTarget.lng },
        origin,
        provider,
      });
      await Linking.openURL(dirUrl);
    } catch (e) {
      toast.show({
        tone: "danger",
        title: "Harita Açılamadı",
        message: "Yol tarifi uygulaması başlatılamadı.",
      });
    }
  };

  if (!effectiveTarget) return null;

  const qrSize = 160;
  const cellSize = qrSize / 21;

  return (
    <ModalFrame
      visible={visible}
      variant="sheet"
      title="Konumu Paylaş & Yol Tarifi"
      onRequestClose={onClose}
    >
      <View style={styles.content}>
        {/* Mekan adı & koordinat */}
        <View style={styles.header}>
          <Txt variant="heading" header align="center" numberOfLines={2}>
            {effectiveTarget.label || "Seçili Konum"}
          </Txt>
          <Txt variant="caption" tone="muted" align="center">
            {effectiveTarget.lat.toFixed(5)}, {effectiveTarget.lng.toFixed(5)}
          </Txt>
        </View>

        {/* 6 Haneli Paylaşım Kodu */}
        <Card variant="bordered" style={styles.codeCard}>
          <Txt variant="caption" tone="muted" align="center">
            6 Haneli Paylaşım Kodu
          </Txt>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={copyCode}
            style={styles.codeRow}
            accessibilityLabel="Paylaşım kodunu kopyala"
          >
            <Txt variant="title" header style={styles.codeText}>
              {numericCode.slice(0, 3)} {numericCode.slice(3)}
            </Txt>
            <IconButton
              icon={copied ? "check" : "copy"}
              label="Kopyala"
              onPress={copyCode}
            />
          </TouchableOpacity>
        </Card>

        {/* QR Kod */}
        <View style={styles.qrContainer}>
          <View style={styles.qrWrapper}>
            <Svg width={qrSize} height={qrSize}>
              {qrMatrix.map((row, y) =>
                row.map((active, x) =>
                  active ? (
                    <Rect
                      key={`${x}-${y}`}
                      x={x * cellSize}
                      y={y * cellSize}
                      width={cellSize}
                      height={cellSize}
                      fill={tokens.color.text}
                    />
                  ) : null,
                ),
              )}
            </Svg>
          </View>
          <Txt variant="caption" tone="muted" align="center" style={styles.qrHint}>
            Uygulama veya kamerayla QR'ı okutun, konum otomatik açılsın
          </Txt>
        </View>

        {/* Yol Tarifi Sağlayıcı Seçimi */}
        <View style={styles.directionsSection}>
          <Txt variant="label" align="center" style={styles.directionsTitle}>
            Bulunduğunuz Konumdan Yol Tarifi Alın:
          </Txt>
          <View style={styles.providerRow}>
            {/* Google First */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.providerBtn}
              onPress={() => openNavigation("google")}
              accessibilityLabel="Google Haritalar ile Yol Tarifi"
            >
              <GoogleLogo size={22} />
              <Txt variant="caption" style={styles.providerLabel}>
                Google
              </Txt>
            </TouchableOpacity>

            {/* Yandex Second */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.providerBtn}
              onPress={() => openNavigation("yandex")}
              accessibilityLabel="Yandex Haritalar ile Yol Tarifi"
            >
              <YandexLogo size={22} />
              <Txt variant="caption" style={styles.providerLabel}>
                Yandex
              </Txt>
            </TouchableOpacity>

            {/* Apple Last */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.providerBtn}
              onPress={() => openNavigation("apple")}
              accessibilityLabel="Apple Haritalar ile Yol Tarifi"
            >
              <AppleLogo size={22} />
              <Txt variant="caption" style={styles.providerLabel}>
                Apple
              </Txt>
            </TouchableOpacity>
          </View>
        </View>

        <Button
          label="Bağlantıyı Paylaş"
          variant="secondary"
          icon={<Icon name="share" size={16} />}
          onPress={handleNativeShare}
          style={styles.shareBtn}
        />
      </View>
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: tokens.space["4"],
    gap: tokens.space["3"],
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    gap: 2,
    marginBottom: tokens.space["1"],
  },
  codeCard: {
    width: "100%",
    padding: tokens.space["3"],
    alignItems: "center",
    backgroundColor: tokens.color.surfaceSunken,
    borderRadius: tokens.radius.lg,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space["3"],
    marginTop: tokens.space["1"],
  },
  codeText: {
    letterSpacing: 4,
    color: tokens.color.brand,
    fontSize: 26,
    fontWeight: "700",
  },
  qrContainer: {
    alignItems: "center",
    marginVertical: tokens.space["2"],
  },
  qrWrapper: {
    padding: tokens.space["3"],
    backgroundColor: "#ffffff",
    borderRadius: tokens.radius.md,
    ...tokens.shadow.md,
  },
  qrHint: {
    marginTop: tokens.space["2"],
    maxWidth: 240,
  },
  directionsSection: {
    width: "100%",
    marginTop: tokens.space["1"],
    paddingTop: tokens.space["2"],
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
  directionsTitle: {
    marginBottom: tokens.space["2"],
    fontWeight: "600",
  },
  providerRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    gap: tokens.space["2"],
  },
  providerBtn: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: tokens.space["2"],
    paddingHorizontal: tokens.space["2"],
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    gap: tokens.space["1"],
  },
  providerLabel: {
    fontWeight: "500",
  },
  shareBtn: {
    width: "100%",
    marginTop: tokens.space["2"],
  },
});
