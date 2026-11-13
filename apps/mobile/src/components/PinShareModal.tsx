import React, { useEffect, useMemo, useState } from "react";
import {
  Clipboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { WebView } from "react-native-webview";
import {
  Button,
  Card,
  Icon,
  IconButton,
  ModalFrame,
  Notice,
  Txt,
  haptic,
  useToast,
} from "../ui";
import { GoogleLogo, YandexLogo, AppleLogo } from "../ui/BrandLogos";
import { QrCodeSvg } from "./QrCodeSvg";
import { tokens } from "../theme";
import {
  buildPinShareUrl,
  decodePinOrUrl,
  generateNumericPinCode,
  type PinPoint,
} from "../share/pin-link";
import { buildDirections, type MapProvider } from "../share/map-directions";

export interface PinShareModalProps {
  visible: boolean;
  onClose: () => void;
  /**
   * "share": Haritalar ekranı — yalnızca seçilen konumun 6 haneli kodu ve QR kodu oluşturulur.
   * "enter": Profil ekranı — yalnızca 6 haneli kod girme ve kamera ile QR okutma gösterilir.
   */
  mode?: "share" | "enter";
  target?: PinPoint | null;
  pin?: { title?: string; label?: string; lat: number; lng: number; address?: string } | null;
  /** Kod çözüldüğünde haritada o noktaya odaklanmak için opsiyonel geri çağırma */
  onNavigateToPoint?: (point: PinPoint) => void;
}

const CAMERA_QR_SCANNER_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; background: ${tokens.color.surfaceInverseStrong}; color: ${tokens.color.textInverse}; font-family: -apple-system, Roboto, sans-serif; overflow: hidden; }
  .wrap { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  video { width: 100%; height: 100%; object-fit: cover; }
  .frame { position: absolute; width: 210px; height: 210px; border: 3px solid ${tokens.color.accentStrong}; border-radius: 20px; box-shadow: 0 0 0 9999px ${tokens.color.scrim}; pointer-events: none; }
  .status { position: absolute; bottom: 14px; left: 16px; right: 16px; text-align: center; font-size: 13px; font-weight: 600; background: ${tokens.color.surfaceInverse}; padding: 8px 12px; border-radius: 10px; }
</style>
</head>
<body>
<div class="wrap">
  <video id="v" playsinline autoplay muted></video>
  <div class="frame"></div>
  <div class="status" id="st">Kamerayı MapsBridge QR koduna doğrultun…</div>
</div>
<script>
  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }
  async function start() {
    var st = document.getElementById("st");
    var video = document.getElementById("v");
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      video.srcObject = stream;
      await video.play();
      if ("BarcodeDetector" in window) {
        var detector = new BarcodeDetector({ formats: ["qr_code"] });
        setInterval(async function() {
          try {
            var codes = await detector.detect(video);
            if (codes && codes.length > 0 && codes[0].rawValue) {
              post({ type: "QR_SCANNED", data: codes[0].rawValue });
            }
          } catch (e) {}
        }, 350);
      } else {
        st.textContent = "Kamera aktif — QR kodu çerçeveye hizalayın.";
      }
    } catch (err) {
      st.textContent = "Kamera akışı başlatılamadı. Aşağıdaki Kamera ile Çek butonunu kullanabilirsiniz.";
      post({ type: "CAMERA_FALLBACK" });
    }
  }
  start();
</script>
</body>
</html>`;

export function PinShareModal({
  visible,
  onClose,
  mode = "share",
  target,
  pin,
  onNavigateToPoint,
}: PinShareModalProps) {
  const toast = useToast();
  const [inputCode, setInputCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resolvedPoint, setResolvedPoint] = useState<PinPoint | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [sharedPageOpen, setSharedPageOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      setInputCode("");
      setCodeError(null);
      setResolvedPoint(null);
      setCopied(null);
      setScannerOpen(false);
      setSharedPageOpen(false);
    }
  }, [visible]);

  const effectiveTarget = useMemo<PinPoint | null>(() => {
    if (target) return { lat: target.lat, lng: target.lng, label: target.label || "Seçilen Konum" };
    if (pin) return { lat: pin.lat, lng: pin.lng, label: pin.title || pin.label || "Seçilen Konum" };
    return null;
  }, [target, pin]);

  const { numericCode, shareUrl } = useMemo(() => {
    if (!effectiveTarget) return { numericCode: "", shareUrl: "" };
    const num = generateNumericPinCode(effectiveTarget);
    const url = buildPinShareUrl(effectiveTarget, "https://mapsbridge.com");
    return { numericCode: num, shareUrl: url };
  }, [effectiveTarget]);

  const resolvedShareUrl = useMemo(() => {
    if (!resolvedPoint) return "";
    return buildPinShareUrl(resolvedPoint, "https://mapsbridge.com");
  }, [resolvedPoint]);

  const copyCode = () => {
    if (!numericCode) return;
    Clipboard.setString(numericCode);
    setCopied("code");
    haptic("selection");
    setTimeout(() => setCopied(null), 2200);
    toast.show({
      tone: "success",
      title: "Konum Kodu Kopyalandı",
      message: `${numericCode} panoya kopyalandı.`,
    });
  };

  const copyLink = () => {
    if (!shareUrl) return;
    Clipboard.setString(shareUrl);
    setCopied("link");
    haptic("selection");
    setTimeout(() => setCopied(null), 2200);
    toast.show({
      tone: "success",
      title: "Paylaşım Bağlantısı Kopyalandı",
      message: "QR bağlantısı panoya kopyalandı.",
    });
  };

  const handleNativeShare = async () => {
    if (!effectiveTarget) return;
    try {
      await Share.share({
        title: effectiveTarget.label || "Paylaşılan Konum",
        message: `📍 ${effectiveTarget.label || "Paylaşılan Konum"}\n6 Haneli Konum Kodu: ${numericCode}\nDoğrudan Konum Sayfası: ${shareUrl}`,
        url: shareUrl,
      });
    } catch {}
  };

  const handleCodeInputChange = (raw: string) => {
    // 6 haneden fazlasına kesinlikle izin verilmez; yalnızca rakam/harf, maksimum 6 karakter
    const cleaned = raw.replace(/[^0-9A-Za-z]/g, "").slice(0, 6);
    setInputCode(cleaned);
    if (codeError) setCodeError(null);
    if (resolvedPoint) setResolvedPoint(null);
  };

  const handleResolveCodeOrQr = (rawValue: string, fromQr = false) => {
    const clean = rawValue.trim();
    if (!fromQr) {
      const sixDigit = clean.replace(/\s+/g, "");
      if (sixDigit.length !== 6) {
        const msg = "Kod hatalı: Lütfen 6 haneli konum kodunu eksiksiz girin.";
        setCodeError(msg);
        setResolvedPoint(null);
        haptic("error");
        toast.show({ tone: "danger", title: "Kod Hatalı", message: msg });
        return;
      }
      const pt = decodePinOrUrl(sixDigit);
      if (!pt) {
        const msg =
          "Kod hatalı: Girdiğiniz 6 haneli konum kodu geçersiz, bulunamadı veya süresi dolmuş.";
        setCodeError(msg);
        setResolvedPoint(null);
        haptic("error");
        toast.show({
          tone: "danger",
          title: "Kod Hatalı",
          message: "Girdiğiniz 6 haneli konum kodu hatalı veya geçersiz.",
        });
        return;
      }
      setCodeError(null);
      setResolvedPoint(pt);
      setSharedPageOpen(true);
      haptic("success");
      toast.show({
        tone: "success",
        title: "Konum Açıldı",
        message: `${pt.label || "Paylaşılan Konum"} sayfasına yönlendirildiniz.`,
      });
      return;
    }

    // QR Okutma: doğrudan paylaşılan sayfaya yönlendirir
    const pt = decodePinOrUrl(clean);
    if (!pt) {
      const msg = "Kod hatalı: Okutulan QR kod geçerli bir MapsBridge konum kodu içermiyor.";
      setCodeError(msg);
      setScannerOpen(false);
      haptic("error");
      toast.show({
        tone: "danger",
        title: "QR Kod Hatalı",
        message: msg,
      });
      return;
    }
    setScannerOpen(false);
    setCodeError(null);
    setResolvedPoint(pt);
    setSharedPageOpen(true);
    haptic("success");
    toast.show({
      tone: "success",
      title: "QR Kod Okundu",
      message: `${pt.label || "Paylaşılan Konum"} sayfası doğrudan açıldı.`,
    });
  };

  const handleNativeCameraScan = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        toast.show({
          tone: "warning",
          title: "Kamera İzni Gerekli",
          message: "QR kodu okutmak için kamera izni vermeniz gerekmektedir.",
        });
        return;
      }
      setScannerOpen(true);
    } catch {
      setScannerOpen(true);
    }
  };

  const openNavigation = async (destPoint: PinPoint, provider: MapProvider) => {
    try {
      let origin: { lat: number; lng: number } | undefined;
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        origin = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      }
      const dirUrl = buildDirections({
        dest: { lat: destPoint.lat, lng: destPoint.lng },
        origin,
        provider,
      });
      await Linking.openURL(dirUrl);
    } catch {
      toast.show({
        tone: "danger",
        title: "Yol Tarifi Açılamadı",
        message: "Seçilen harita uygulaması açılamadı.",
      });
    }
  };

  const modalTitle =
    mode === "share" ? "Seçilen Konum Kodu & QR Paylaşımı" : "Konum Kodu Gir & QR Okut";

  return (
    <ModalFrame
      visible={visible}
      variant="sheet"
      title={modalTitle}
      onRequestClose={onClose}
    >
      <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
        {mode === "share" ? (
          /* HARİTALAR EKRANI MODU: Yalnızca seçilen konumun net başlığı, 6 haneli kodu ve QR kodu */
          <View style={styles.tabContent}>
            <View style={styles.crispHeaderBanner}>
              <View style={styles.crispHeaderIcon}>
                <Icon name="map" size={24} color={tokens.color.onPrimary} />
              </View>
              <View style={styles.crispHeaderTexts}>
                <Txt variant="eyebrow" style={styles.crispEyebrow}>
                  SEÇİLEN HARİTA KONUMU
                </Txt>
                <Txt variant="heading" header style={styles.crispLocationTitle}>
                  {effectiveTarget?.label || "Seçilen Konum"}
                </Txt>
                {pin?.address ? (
                  <Txt variant="small" style={styles.crispLocationSub}>
                    {pin.address}
                  </Txt>
                ) : effectiveTarget ? (
                  <Txt variant="small" style={styles.crispLocationSub}>
                    {`${effectiveTarget.lat.toFixed(5)}, ${effectiveTarget.lng.toFixed(5)}`}
                  </Txt>
                ) : null}
              </View>
            </View>

            <View style={styles.codeCard}>
              <Txt variant="label" style={styles.codeCardHeaderLabel} align="center">
                6 HANELİ KONUM KODU
              </Txt>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`6 haneli konum kodu ${numericCode}, kopyalamak için dokunun`}
                onPress={copyCode}
                style={styles.codeRow}
              >
                <Txt variant="display" header style={styles.codeText}>
                  {numericCode ? `${numericCode.slice(0, 3)} ${numericCode.slice(3)}` : "--- ---"}
                </Txt>
                <IconButton
                  icon={copied === "code" ? "check" : "copy"}
                  label="Kodu Kopyala"
                  onPress={copyCode}
                />
              </Pressable>
              <Txt variant="caption" style={styles.codeCardHint} align="center">
                Arkadaşınız Profil ekranından bu 6 haneli kodu girerek veya aşağıdaki QR kodu okutarak doğrudan bu konuma gidebilir.
              </Txt>
            </View>

            {shareUrl ? (
              <View style={styles.qrSectionCard}>
                <Txt variant="label" header style={styles.qrTitle}>
                  QR Kodu Okutun — Doğrudan Paylaşılan Sayfaya Gider
                </Txt>
                <View style={styles.qrFrame}>
                  <QrCodeSvg
                    value={shareUrl}
                    size={176}
                    title={`${effectiveTarget?.label || "Konum"} QR Kodu`}
                  />
                </View>
                <Txt variant="caption" style={styles.qrUrlText} align="center" numberOfLines={2}>
                  {shareUrl}
                </Txt>
                <Button
                  label="Paylaşılan Konum Sayfasını Aç"
                  variant="secondary"
                  size="sm"
                  icon={<Icon name="external" size={16} />}
                  onPress={() => {
                    if (effectiveTarget) {
                      setResolvedPoint(effectiveTarget);
                      setSharedPageOpen(true);
                    }
                  }}
                />
              </View>
            ) : null}

            { sharedPageOpen && effectiveTarget ? (
              <Card variant="bordered" style={styles.sharedPreviewCard}>
                <Txt variant="eyebrow" tone="highlight">
                  PAYLAŞILAN KONUM SAYFASI ÖNİZLEMESİ
                </Txt>
                <Txt variant="heading" header>
                  {effectiveTarget.label}
                </Txt>
                <View style={styles.navButtonsRow}>
                  {Platform.OS === "ios" ? (
                    <Pressable
                      accessibilityRole="button"
                      style={styles.providerBtn}
                      onPress={() => void openNavigation(effectiveTarget, "apple")}
                    >
                      <AppleLogo size={20} />
                      <Txt variant="caption" style={styles.providerLabel}>
                        Apple
                      </Txt>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    style={styles.providerBtn}
                    onPress={() => void openNavigation(effectiveTarget, "google")}
                  >
                    <GoogleLogo size={20} />
                    <Txt variant="caption" style={styles.providerLabel}>
                      Google
                    </Txt>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.providerBtn}
                    onPress={() => void openNavigation(effectiveTarget, "yandex")}
                  >
                    <YandexLogo size={20} />
                    <Txt variant="caption" style={styles.providerLabel}>
                      Yandex
                    </Txt>
                  </Pressable>
                </View>
              </Card>
            ) : null }

            <View style={styles.shareActions}>
              <Button
                label="Kodu ve Bağlantıyı Paylaş"
                icon={<Icon name="share" size={16} />}
                size="lg"
                onPress={handleNativeShare}
              />
              <View style={styles.secondaryRow}>
                <Button
                  style={styles.halfBtn}
                  label={copied === "code" ? "Kod Kopyalandı" : "Kodu Kopyala"}
                  variant="secondary"
                  size="md"
                  onPress={copyCode}
                />
                <Button
                  style={styles.halfBtn}
                  label={copied === "link" ? "Bağlantı Kopyalandı" : "Bağlantıyı Kopyala"}
                  variant="secondary"
                  size="md"
                  onPress={copyLink}
                />
              </View>
            </View>
          </View>
        ) : (
          /* PROFİL EKRANI MODU: Yalnızca 6 Haneli Kod Girişi (max 6 hane) ve Kamera ile QR Okutma */
          <View style={styles.tabContent}>
            <View style={styles.crispHeaderBanner}>
              <View style={styles.crispHeaderIcon}>
                <Icon name="qr" size={24} color={tokens.color.onPrimary} />
              </View>
              <View style={styles.crispHeaderTexts}>
                <Txt variant="eyebrow" style={styles.crispEyebrow}>
                  KONUM KODU & QR OKUYUCU
                </Txt>
                <Txt variant="heading" header style={styles.crispLocationTitle}>
                  6 Haneli Kod Girin veya QR Okutun
                </Txt>
                <Txt variant="small" style={styles.crispLocationSub}>
                  Paylaşılan 6 haneli kodu yazın ya da kamerayla QR kodu okutarak doğrudan paylaşılan konum sayfasına gidin.
                </Txt>
              </View>
            </View>

            {/* Hatalı kod girildiğinde sayfa üzerinde net bildirim */}
            {codeError ? (
              <Notice tone="danger" title="Kod Hatalı">
                {codeError}
              </Notice>
            ) : null}

            <View style={styles.inputCard}>
              <Txt variant="label" header>
                6 Haneli Konum Kodu (En Fazla 6 Hane)
              </Txt>
              <TextInput
                style={[
                  styles.largeCodeInput,
                  codeError ? styles.largeCodeInputError : null,
                ]}
                placeholder="Örn: 482910"
                placeholderTextColor={tokens.color.fieldPlaceholder}
                value={inputCode}
                onChangeText={handleCodeInputChange}
                maxLength={6}
                keyboardType="number-pad"
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel="6 Haneli Konum Kodu Girişi"
              />
              <Txt variant="caption" tone="muted" align="center">
                {`${inputCode.length} / 6 hane girildi`}
              </Txt>
              <Button
                label="Konum Kodunu Doğrula & Aç"
                size="lg"
                icon={<Icon name="search" size={16} />}
                onPress={() => handleResolveCodeOrQr(inputCode, false)}
              />
            </View>

            <View style={styles.cameraSectionCard}>
              <View style={styles.cameraHeaderRow}>
                <Icon name="camera" size={20} color={tokens.color.primary} />
                <Txt variant="heading" header style={{ flex: 1 }}>
                  QR Kodu Kamera ile Okut
                </Txt>
              </View>
              <Txt variant="small" tone="muted">
                Karşı tarafın harita ekranındaki QR kodu kameranızla okutarak doğrudan paylaşılan konum sayfasına gidin:
              </Txt>

              {!scannerOpen ? (
                <Button
                  label="Kamerayı Aç & QR Okut"
                  variant="secondary"
                  size="lg"
                  icon={<Icon name="camera" size={16} />}
                  onPress={handleNativeCameraScan}
                />
              ) : (
                <View style={styles.scannerBox}>
                  <View style={styles.scannerWebViewWrap}>
                    <WebView
                      originWhitelist={["*"]}
                      source={{ html: CAMERA_QR_SCANNER_HTML, baseUrl: "https://mapsbridge.com" }}
                      style={styles.scannerWebView}
                      accessibilityLabel="QR Kod Kamera Okuyucu"
                      javaScriptEnabled
                      domStorageEnabled
                      mediaPlaybackRequiresUserAction={false}
                      allowsInlineMediaPlayback
                      onMessage={(e) => {
                        try {
                          const msg = JSON.parse(e.nativeEvent.data);
                          if (msg?.type === "QR_SCANNED" && typeof msg.data === "string") {
                            handleResolveCodeOrQr(msg.data, true);
                          }
                        } catch {}
                      }}
                    />
                  </View>
                  <Button
                    label="Kamerayı Kapat"
                    variant="ghost"
                    size="sm"
                    onPress={() => setScannerOpen(false)}
                  />
                </View>
              )}
            </View>

            {/* Doğrulanan / Okutulan Paylaşılan Konum Sayfası */}
            {resolvedPoint && sharedPageOpen ? (
              <Card variant="bordered" style={styles.resolvedCard}>
                <View style={styles.resolvedBadgeRow}>
                  <Icon name="check" size={16} color={tokens.color.success} />
                  <Txt variant="eyebrow" style={{ color: tokens.color.success }}>
                    PAYLAŞILAN KONUM SAYFASI AÇILDI
                  </Txt>
                </View>
                <View style={styles.resolvedHead}>
                  <Icon name="map" size={24} color={tokens.color.brand} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="title" header>
                      {resolvedPoint.label || "Paylaşılan Hedef Konum"}
                    </Txt>
                    <Txt variant="small" tone="muted">
                      {`Koordinatlar: ${resolvedPoint.lat.toFixed(5)}, ${resolvedPoint.lng.toFixed(5)}`}
                    </Txt>
                  </View>
                </View>

                <Txt variant="label" align="center" style={{ marginTop: 6 }}>
                  Doğrudan Yol Tarifi Başlat:
                </Txt>
                <View style={styles.navButtonsRow}>
                  {Platform.OS === "ios" ? (
                    <Pressable
                      accessibilityRole="button"
                      style={styles.providerBtn}
                      onPress={() => void openNavigation(resolvedPoint, "apple")}
                    >
                      <AppleLogo size={22} />
                      <Txt variant="caption" style={styles.providerLabel}>
                        Apple
                      </Txt>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    style={styles.providerBtn}
                    onPress={() => void openNavigation(resolvedPoint, "google")}
                  >
                    <GoogleLogo size={22} />
                    <Txt variant="caption" style={styles.providerLabel}>
                      Google
                    </Txt>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.providerBtn}
                    onPress={() => void openNavigation(resolvedPoint, "yandex")}
                  >
                    <YandexLogo size={22} />
                    <Txt variant="caption" style={styles.providerLabel}>
                      Yandex
                    </Txt>
                  </Pressable>
                </View>

                {resolvedShareUrl ? (
                  <Button
                    label="Web Paylaşım Sayfasında Görüntüle"
                    variant="secondary"
                    size="sm"
                    icon={<Icon name="external" size={16} />}
                    onPress={() => {
                      Linking.openURL(resolvedShareUrl).catch(() => undefined);
                    }}
                  />
                ) : null}

                {onNavigateToPoint ? (
                  <Button
                    label="Uygulama Haritasında Göster"
                    variant="primary"
                    size="md"
                    onPress={() => {
                      onNavigateToPoint(resolvedPoint);
                      onClose();
                    }}
                  />
                ) : null}
              </Card>
            ) : null}
          </View>
        )}
      </ScrollView>
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: tokens.space["4"],
    paddingBottom: tokens.space["10"],
    gap: tokens.space["4"],
  },
  tabContent: {
    gap: tokens.space["4"],
  },
  crispHeaderBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["3"],
    padding: tokens.space["4"],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surfaceBrand,
    borderWidth: 1.5,
    borderColor: tokens.color.primary,
  },
  crispHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  crispHeaderTexts: {
    flex: 1,
    gap: 2,
  },
  crispEyebrow: {
    color: tokens.color.primary,
    fontWeight: "800",
  },
  crispLocationTitle: {
    color: tokens.color.text,
    fontSize: tokens.font.size.lg,
    fontWeight: "800",
  },
  crispLocationSub: {
    color: tokens.color.text,
    fontWeight: "500",
  },
  inputCard: {
    backgroundColor: tokens.color.surface,
    padding: tokens.space["4"],
    borderRadius: tokens.radius.lg,
    borderWidth: 1.5,
    borderColor: tokens.color.borderStrong,
    gap: tokens.space["3"],
  },
  largeCodeInput: {
    height: 58,
    borderWidth: 2,
    borderColor: tokens.color.primary,
    borderRadius: tokens.radius.md,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 6,
    color: tokens.color.text,
    backgroundColor: tokens.color.surface,
  },
  largeCodeInputError: {
    borderColor: tokens.color.danger,
    backgroundColor: tokens.color.dangerBg,
  },
  cameraSectionCard: {
    backgroundColor: tokens.color.surface,
    padding: tokens.space["4"],
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.borderStrong,
    gap: tokens.space["3"],
  },
  cameraHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["2"],
  },
  scannerBox: {
    gap: tokens.space["2"],
  },
  scannerWebViewWrap: {
    height: 250,
    borderRadius: tokens.radius.lg,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: tokens.color.primary,
    backgroundColor: tokens.color.surfaceInverseStrong,
  },
  scannerWebView: {
    flex: 1,
    backgroundColor: tokens.color.surfaceInverseStrong,
  },
  resolvedCard: {
    padding: tokens.space["4"],
    gap: tokens.space["3"],
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.primary,
    borderWidth: 1.5,
  },
  resolvedBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["1"],
  },
  resolvedHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["3"],
  },
  navButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: tokens.space["2"],
    marginVertical: tokens.space["1"],
  },
  providerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: tokens.space["2"],
    paddingHorizontal: tokens.space["2"],
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surfaceSunken,
    borderWidth: 1,
    borderColor: tokens.color.borderStrong,
  },
  providerLabel: {
    fontWeight: "700",
    fontSize: 13,
    color: tokens.color.text,
  },
  codeCard: {
    padding: tokens.space["4"],
    alignItems: "center",
    gap: tokens.space["2"],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surface,
    borderWidth: 2,
    borderColor: tokens.color.primary,
  },
  codeCardHeaderLabel: {
    color: tokens.color.primary,
    fontWeight: "800",
    letterSpacing: 1,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["3"],
    paddingVertical: tokens.space["1"],
  },
  codeText: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 4,
    color: tokens.color.primary,
  },
  codeCardHint: {
    color: tokens.color.text,
  },
  qrSectionCard: {
    padding: tokens.space["4"],
    alignItems: "center",
    gap: tokens.space["3"],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surface,
    borderWidth: 1.5,
    borderColor: tokens.color.borderStrong,
  },
  qrTitle: {
    color: tokens.color.text,
    textAlign: "center",
  },
  qrFrame: {
    padding: tokens.space["3"],
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.neutral0,
    borderWidth: 1,
    borderColor: tokens.color.borderStrong,
  },
  qrUrlText: {
    color: tokens.color.textMuted,
  },
  sharedPreviewCard: {
    padding: tokens.space["3"],
    gap: tokens.space["2"],
  },
  shareActions: {
    gap: tokens.space["2"],
  },
  secondaryRow: {
    flexDirection: "row",
    gap: tokens.space["2"],
  },
  halfBtn: {
    flex: 1,
  },
});
