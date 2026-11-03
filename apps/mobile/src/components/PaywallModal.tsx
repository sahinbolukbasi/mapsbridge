"use client";
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from "react-native";
import type { PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import { getOfferings, purchasePackage, restorePurchases, isProSync } from "../services/revenuecat";

import { ModalFrame } from "../ui";
import { tokens, withAlpha } from "../theme";
interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful purchase or restore with pro status */
  onProUnlocked?: () => void;
  /** Dönüşüm ölçümü için paywall yerleşim adı (ör. "plan_screen", "profile"). */
  placement?: string;
}

const PLAN_ICONS: Record<string, string> = {
  $rc_monthly: "🗓️",
  $rc_annual: "⭐",
  $rc_lifetime: "♾️",
};

const PLAN_LABELS: Record<string, string> = {
  $rc_monthly: "Aylık",
  $rc_annual: "Yıllık",
  $rc_lifetime: "Yaşam Boyu",
};

const PLAN_BADGE: Record<string, string | undefined> = {
  $rc_annual: "En Popüler",
  $rc_lifetime: "En İyi Değer",
};

const PRO_FEATURES = [
  { icon: "✈️", text: "Sınırsız rota ve durak" },
  { icon: "🤖", text: "Gelişmiş AI asistan (öncelikli)" },
  { icon: "📋", text: "Hazır şehir şablonları" },
  { icon: "🗺️", text: "Çevrimdışı rota erişimi" },
  { icon: "📤", text: "Google Haritalar & PDF dışa aktarım" },
  { icon: "🔄", text: "Çoklu cihaz senkronizasyonu" },
  { icon: "🎯", text: "Kişiselleştirilmiş öneriler" },
];

export function PaywallModal({ visible, onClose, onProUnlocked, placement }: PaywallModalProps) {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<string>("$rc_annual");

  const loadOfferings = useCallback(async () => {
    setLoading(true);
    try {
      const off = await getOfferings();
      setOffering(off);
    } catch {
      // Silently fail — show static prices
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) loadOfferings();
  }, [visible, loadOfferings]);

  // Check if already Pro
  useEffect(() => {
    if (visible && isProSync()) {
      onProUnlocked?.();
      onClose();
    }
  }, [visible]);

  const getPackage = (identifier: string): PurchasesPackage | undefined =>
    offering?.availablePackages.find((p) => p.identifier === identifier);

  const priceOf = (identifier: string): string => {
    const pkg = getPackage(identifier);
    if (!pkg) return "—";
    return pkg.product.priceString;
  };

  const handlePurchase = async () => {
    const pkg = getPackage(selectedPkg);
    if (!pkg) {
      Alert.alert("Hata", "Paket yüklenemedi. Lütfen tekrar deneyin.");
      return;
    }
    setPurchasing(true);
    try {
      const result = await purchasePackage(pkg, placement);
      if (result.success) {
        Alert.alert("🎉 Pro aktif!", "MapsBridge Pro özelliklerine erişiminiz açıldı.", [
          {
            text: "Harika!",
            onPress: () => {
              onProUnlocked?.();
              onClose();
            },
          },
        ]);
      } else if (result.error !== "cancelled") {
        Alert.alert("Satın Alma Başarısız", result.error || "Lütfen tekrar deneyin.");
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.isPro) {
        Alert.alert("✅ Geri Yüklendi", "Pro aboneliğiniz yeniden etkinleştirildi.", [
          {
            text: "Devam Et",
            onPress: () => {
              onProUnlocked?.();
              onClose();
            },
          },
        ]);
      } else {
        Alert.alert("Abonelik Bulunamadı", "Bu hesaba bağlı aktif bir Pro aboneliği bulunamadı.");
      }
    } finally {
      setRestoring(false);
    }
  };

  const packages = offering?.availablePackages ?? [
    { identifier: "$rc_monthly" },
    { identifier: "$rc_annual" },
    { identifier: "$rc_lifetime" },
  ];

  return (
    <ModalFrame
      visible={visible}
      variant="sheet"
      animation="slide"
      onRequestClose={onClose}
      style={styles.container}
    >
      {/* Close */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={onClose}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.closeBtnText}>
          ✕
        </Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.badge}>
            MapsBridge PRO
          </Text>
          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.headline}>
            Seyahatin tüm gücü{"\n"}elinin altında
          </Text>
          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.subheadline}>
            Sınırsız rota, AI asistan ve premium özelliklerle{"\n"}seyahat planlamanı bir üst
            seviyeye taşı.
          </Text>
        </View>

        {/* Feature List */}
        <View style={styles.featureList}>
          {PRO_FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.featureIcon}>
                {f.icon}
              </Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.featureText}>
                {f.text}
              </Text>
            </View>
          ))}
        </View>

        {/* Plan Cards */}
        <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.sectionLabel}>
          Plan Seç
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={tokens.color.accentStrong}
            style={{ marginVertical: 24 }}
          />
        ) : (
          <View style={styles.planCards}>
            {(packages as PurchasesPackage[]).map((pkg) => {
              const id: string = pkg.identifier;
              const isSelected = selectedPkg === id;
              const badge = PLAN_BADGE[id];
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.planCard, isSelected && styles.planCardSelected]}
                  onPress={() => setSelectedPkg(id)}
                  activeOpacity={0.8}
                >
                  {badge && (
                    <View style={styles.planBadge}>
                      <Text
                        maxFontSizeMultiplier={tokens.font.maxScale.compact}
                        style={styles.planBadgeText}
                      >
                        {badge}
                      </Text>
                    </View>
                  )}
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.planIcon}>
                    {PLAN_ICONS[id] ?? "📦"}
                  </Text>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={[styles.planLabel, isSelected && styles.planLabelSelected]}
                  >
                    {PLAN_LABELS[id] ?? id}
                  </Text>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={[styles.planPrice, isSelected && styles.planPriceSelected]}
                  >
                    {priceOf(id)}
                  </Text>
                  {id === "$rc_annual" && (
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.planSave}>
                      Aylığa göre %50 tasarruf
                    </Text>
                  )}
                  {id === "$rc_lifetime" && (
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.planSave}>
                      Tek seferlik ödeme
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, (purchasing || loading) && styles.ctaBtnDisabled]}
          onPress={handlePurchase}
          disabled={purchasing || loading}
          activeOpacity={0.85}
        >
          {purchasing ? (
            <ActivityIndicator color={tokens.color.surfaceInverseStrong} />
          ) : (
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.ctaBtnText}>
              {selectedPkg === "$rc_lifetime" ? "Pro'ya Geç — Ömür Boyu" : "Pro'ya Geç"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Restore */}
        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={restoring}>
          {restoring ? (
            <ActivityIndicator size="small" color={tokens.color.neutral400} />
          ) : (
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.restoreBtnText}>
              Önceki Satın Alımı Geri Yükle
            </Text>
          )}
        </TouchableOpacity>

        {/* Legal */}
        <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.legal}>
          Abonelik {Platform.OS === "ios" ? "App Store" : "Google Play"} üzerinden yönetilir.
          Abonelikler, iptal tarihinden 24 saat önce otomatik olarak yenilenir.{" "}
          <Text
            maxFontSizeMultiplier={tokens.font.maxScale.body}
            style={styles.legalLink}
            onPress={() => Linking.openURL("https://mapsbridge.com/privacy")}
          >
            Gizlilik Politikası
          </Text>
          {" · "}
          <Text
            maxFontSizeMultiplier={tokens.font.maxScale.body}
            style={styles.legalLink}
            onPress={() => Linking.openURL("https://mapsbridge.com/terms")}
          >
            Kullanım Koşulları
          </Text>
        </Text>
      </ScrollView>
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.surfaceInverseStrong,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 20,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: withAlpha(tokens.color.surface, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    color: tokens.color.neutral400,
    fontSize: 14,
    fontWeight: "700",
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 48,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  badge: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    color: tokens.color.accentStrong,
    textTransform: "uppercase",
    marginBottom: 12,
    backgroundColor: withAlpha(tokens.color.accentStrong, 0.12),
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: "hidden",
  },
  headline: {
    fontSize: 28,
    fontWeight: "800",
    color: tokens.color.surfaceSunken,
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 10,
  },
  subheadline: {
    fontSize: 14,
    color: tokens.color.neutral400,
    textAlign: "center",
    lineHeight: 20,
  },
  featureList: {
    backgroundColor: withAlpha(tokens.color.surface, 0.04),
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
    gap: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    fontSize: 18,
    width: 28,
    textAlign: "center",
  },
  featureText: {
    fontSize: 14,
    color: tokens.color.neutral300,
    flex: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    color: tokens.color.textSubtle,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  planCards: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  planCard: {
    flex: 1,
    backgroundColor: withAlpha(tokens.color.surface, 0.05),
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: tokens.color.whiteA08,
    position: "relative",
  },
  planCardSelected: {
    borderColor: tokens.color.accentStrong,
    backgroundColor: withAlpha(tokens.color.accentStrong, 0.08),
  },
  planBadge: {
    position: "absolute",
    top: -10,
    backgroundColor: tokens.color.accentStrong,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  planBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: tokens.color.surfaceInverseStrong,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  planIcon: {
    fontSize: 22,
    marginBottom: 6,
    marginTop: 4,
  },
  planLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.color.neutral400,
    marginBottom: 4,
  },
  planLabelSelected: {
    color: tokens.color.accentStrong,
  },
  planPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: tokens.color.neutral200,
    textAlign: "center",
  },
  planPriceSelected: {
    color: tokens.color.surfaceSunken,
  },
  planSave: {
    fontSize: 9,
    color: tokens.color.accentStrong,
    marginTop: 4,
    textAlign: "center",
    fontWeight: "600",
  },
  ctaBtn: {
    backgroundColor: tokens.color.accentStrong,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 14,
  },
  ctaBtnDisabled: {
    opacity: 0.6,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: tokens.color.surfaceInverseStrong,
    letterSpacing: 0.3,
  },
  restoreBtn: {
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 24,
  },
  restoreBtnText: {
    fontSize: 13,
    color: tokens.color.textSubtle,
    textDecorationLine: "underline",
  },
  legal: {
    fontSize: 11,
    color: tokens.color.textMuted,
    textAlign: "center",
    lineHeight: 16,
  },
  legalLink: {
    color: tokens.color.textSubtle,
    textDecorationLine: "underline",
  },
});
