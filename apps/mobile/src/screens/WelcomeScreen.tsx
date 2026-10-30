import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppleLogo, GoogleLogo, ArrowRightIcon, ExploreIcon } from "../components/Icons";

import { Screen } from "../ui";
import { tokens, withAlpha } from "../theme";
interface WelcomeScreenProps {
  onSelectAuth: (mode: "login" | "register" | "apple" | "google") => void;
}



const HERO_BG_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCaPLUeaEdYQRXIb63qG6CQVE5pIsJ3pdFATx3iB93-HGlrPZfQ6s64wc_Z7beqhxGveCM4xVoGOJBKUebET4EYp8dSe1Dg2hWdnn18naZZbABJb2nXG3uwSKtTfBPHJdai8N29ElVda23JdLDmPbm4iPlFjPrBVMJBKtDHTpEf1uY6S5_1DNw_u5WTbiGVIvbpmd-qgM8k8hOyziGwozLL1E7IH4cAF88BIHfe_c_Q4kH9d33y9Um3Pw";

export function WelcomeScreen({ onSelectAuth }: WelcomeScreenProps) {
  return (
    <Screen style={styles.safeArea} background="surfaceInverse">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Immersive Hero Visual Section with Full-Bleed Image & Blended Mask */}
        <View style={styles.heroSection}>
          <Image source={{ uri: HERO_BG_IMAGE }} style={styles.heroBgImage} resizeMode="cover" />

          {/* Atmospheric gradient overlays */}
          <LinearGradient
            colors={[withAlpha(tokens.color.surfaceInverse, 0.75), "transparent", tokens.color.bg]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["transparent", withAlpha(tokens.color.bg, 0.85), tokens.color.bg]}
            locations={[0.5, 0.82, 1]}
            style={styles.bottomBlendMask}
          />

          {/* Top Status & Brand Header Pill */}
          <View style={styles.headerBar}>
            <View style={styles.brandPill}>
              <View style={styles.brandIconCircle}>
                <ExploreIcon size={14} color={tokens.color.onAccent} />
              </View>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.brandText}>MapsBridge</Text>
              <View style={styles.pulseDot} />
            </View>
          </View>

          {/* Floating Interactive Glassmorphism Route Card (Stitch Spec) */}
          <View style={styles.glassCardWrapper}>
            <View style={styles.glassCard}>
              {/* Card Header */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={styles.cardPulseDot} />
                  <View>
                    <View style={styles.cardStatusRow}>
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.cardStatusAi}>AI CANLI ROTA</Text>
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.cardStatusDot}>•</Text>
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.cardStatusGps}>GPS Aktif</Text>
                    </View>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.cardTitle}>Kapadokya Balon Vadisi</Text>
                  </View>
                </View>
                <View style={styles.savingsPill}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.savingsPillText}>⚡ 30 sn • %40 Tasarruf</Text>
                </View>
              </View>

              {/* Waypoints List */}
              <View style={styles.waypointsList}>
                {/* Connecting dashed line */}
                <View style={styles.timelineTrack} />

                {/* Stop 1 */}
                <View style={styles.waypointRow}>
                  <View style={styles.badge1}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.badge1Text}>1</Text>
                  </View>
                  <View style={styles.waypointInfo}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.waypointName} numberOfLines={1}>
                      Aşk Vadisi (Seyir Terası)
                    </Text>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.waypointTime}>05:45 • Gün Doğumu & Balonlar</Text>
                  </View>
                  <View style={styles.distPill}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.distPillText}>1.8 km • ~12 dk</Text>
                  </View>
                </View>

                {/* Stop 2 */}
                <View style={styles.waypointRow}>
                  <View style={styles.badge2}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.badge2Text}>2</Text>
                  </View>
                  <View style={styles.waypointInfo}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.waypointName} numberOfLines={1}>
                      Göreme Açık Hava Müzesi
                    </Text>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.waypointTimeDim}>07:15 • 4 Tarihi Durak</Text>
                  </View>
                  <View style={styles.distPillDim}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.distPillDimText}>2.4 km</Text>
                  </View>
                </View>

                {/* Stop 3 */}
                <View style={styles.waypointRow}>
                  <View style={styles.badge3}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.badge3Text}>🏁</Text>
                  </View>
                  <View style={styles.waypointInfo}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.waypointName} numberOfLines={1}>
                      Uçhisar Kalesi
                    </Text>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.waypointTimeDim}>09:30 • Panoramik Gün Sonu</Text>
                  </View>
                  <View style={styles.distPillAccent}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.distPillAccentText}>Varış</Text>
                  </View>
                </View>
              </View>

              {/* Card Footer Bar */}
              <View style={styles.cardFooterBar}>
                <View style={styles.cardFooterStats}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.cardFooterStatPill}>📍 8 Durak</Text>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.cardFooterStatPill}>🧭 5.1 km Toplam</Text>
                </View>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.cardFooterAction}>✨ AKILLI SIRALAMA</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Editorial Headline & Value Proposition */}
        <View style={styles.editorialSection}>
          {/* Onboarding Progress Indicator */}
          <View style={styles.progressRow}>
            <View style={styles.progressBarActive} />
            <View style={styles.progressDot} />
            <View style={styles.progressDot} />
          </View>

          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.headline}>
            Daha az planla,{"\n"}
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.headlineAccent}>daha çok keşfet.</Text>
          </Text>

          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.subtitle}>
            Yapay zeka asistanı ve gezgin topluluğuyla rotanı anında oluştur, haritada tek dokunuşla
            canlı keşfe başla.
          </Text>
        </View>

        {/* Auth CTA Actions */}
        <View style={styles.actionsSection}>
          {/* Primary CTA: E-posta ile Ücretsiz Başla */}
          <TouchableOpacity
            style={styles.primaryEmailBtn}
            onPress={() => onSelectAuth("register")}
            activeOpacity={0.88}
          >
            <View style={styles.primaryEmailLeft}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 18 }}>✉️</Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.primaryEmailText}>E-posta ile Ücretsiz Başla</Text>
            </View>
            <View style={styles.arrowCircle}>
              <ArrowRightIcon size={14} color={tokens.color.accentStrong} />
            </View>
          </TouchableOpacity>

          {/* Split Social Sign-In Row (Google + Apple) */}
          <View style={styles.socialRow}>
            {/* Google */}
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => onSelectAuth("google")}
              activeOpacity={0.85}
            >
              <GoogleLogo size={18} />
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.socialBtnText}>Google</Text>
            </TouchableOpacity>

            {/* Apple */}
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => onSelectAuth("apple")}
              activeOpacity={0.85}
            >
              <AppleLogo size={18} color={tokens.color.text} />
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.socialBtnText}>Apple</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign In Navigation Link */}
        <View style={styles.loginLinkRow}>
          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.loginLinkMuted}>Zaten hesabın var mı? </Text>
          <TouchableOpacity onPress={() => onSelectAuth("login")}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.loginLinkActive}>Giriş Yap ➔</Text>
          </TouchableOpacity>
        </View>

        {/* Legal Footer */}
        <View style={styles.legalSection}>
          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.legalText}>
            Devam ederek <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.legalLink}>Kullanım Şartları</Text> ve{" "}
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.legalLink}>Gizlilik Politikası</Text>'nı onaylamış olursunuz.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.color.bg,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  heroSection: {
    position: "relative",
    width: "100%",
    minHeight: 410,
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    overflow: "hidden",
  },
  heroBgImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: 410,
  },
  bottomBlendMask: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  headerBar: {
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 4,
  },
  brandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: withAlpha(tokens.color.surfaceInverse, 0.72),
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withAlpha(tokens.color.accentStrong, 0.25),
  },
  brandIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.color.accentStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 13,
    fontWeight: "800",
    color: tokens.color.surfaceBrand,
    letterSpacing: -0.2,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.color.accentStrong,
    marginLeft: 2,
  },
  glassCardWrapper: {
    zIndex: 10,
    marginTop: 18,
  },
  glassCard: {
    borderRadius: 20,
    backgroundColor: withAlpha(tokens.color.surfaceInverse, 0.88),
    borderWidth: 1,
    borderColor: withAlpha(tokens.color.neutral0, 0.16),
    padding: 15,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  cardPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.color.accentStrong,
    shadowColor: tokens.color.accentStrong,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  cardStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardStatusAi: {
    color: tokens.color.accentStrong,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cardStatusDot: {
    color: withAlpha(tokens.color.onPrimary, 0.4),
    fontSize: 10,
  },
  cardStatusGps: {
    color: withAlpha(tokens.color.onPrimary, 0.7),
    fontSize: 10,
    fontWeight: "600",
  },
  cardTitle: {
    color: tokens.color.onPrimary,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: -0.2,
  },
  savingsPill: {
    backgroundColor: withAlpha(tokens.color.accentStrong, 0.15),
    borderWidth: 1,
    borderColor: withAlpha(tokens.color.accentStrong, 0.35),
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  savingsPillText: {
    color: tokens.color.accentStrong,
    fontSize: 10,
    fontWeight: "700",
  },
  waypointsList: {
    position: "relative",
    gap: 10,
    marginVertical: 4,
  },
  timelineTrack: {
    position: "absolute",
    left: 11,
    top: 14,
    bottom: 14,
    width: 2,
    backgroundColor: withAlpha(tokens.color.accentStrong, 0.35),
  },
  waypointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badge1: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.color.accentStrong,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  badge1Text: {
    color: tokens.color.onAccent,
    fontSize: 11,
    fontWeight: "800",
  },
  badge2: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: withAlpha(tokens.color.surface, 0.18),
    borderWidth: 1,
    borderColor: withAlpha(tokens.color.neutral0, 0.35),
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  badge2Text: {
    color: tokens.color.onPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  badge3: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: withAlpha(tokens.color.accent, 0.25),
    borderWidth: 1,
    borderColor: withAlpha(tokens.color.accentStrong, 0.5),
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  badge3Text: {
    fontSize: 10,
  },
  waypointInfo: {
    flex: 1,
  },
  waypointName: {
    color: tokens.color.onPrimary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  waypointTime: {
    color: withAlpha(tokens.color.accentStrong, 0.95),
    fontSize: 10,
    fontWeight: "500",
    marginTop: 1,
  },
  waypointTimeDim: {
    color: withAlpha(tokens.color.onPrimary, 0.65),
    fontSize: 10,
    fontWeight: "500",
    marginTop: 1,
  },
  distPill: {
    backgroundColor: tokens.color.whiteA12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  distPillText: {
    color: tokens.color.onPrimary,
    fontSize: 10,
    fontWeight: "600",
  },
  distPillDim: {
    backgroundColor: tokens.color.whiteA08,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  distPillDimText: {
    color: withAlpha(tokens.color.onPrimary, 0.75),
    fontSize: 10,
    fontWeight: "600",
  },
  distPillAccent: {
    backgroundColor: withAlpha(tokens.color.accentStrong, 0.18),
    borderWidth: 1,
    borderColor: withAlpha(tokens.color.accentStrong, 0.35),
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  distPillAccentText: {
    color: tokens.color.accentStrong,
    fontSize: 10,
    fontWeight: "700",
  },
  cardFooterBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.color.whiteA12,
  },
  cardFooterStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardFooterStatPill: {
    color: withAlpha(tokens.color.onPrimary, 0.85),
    fontSize: 10,
    fontWeight: "600",
    backgroundColor: tokens.color.whiteA08,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  cardFooterAction: {
    color: tokens.color.accentStrong,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  editorialSection: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 18,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  progressBarActive: {
    width: 24,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: tokens.color.primary,
  },
  progressDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: tokens.color.neutral300,
  },
  headline: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: tokens.color.textBrand,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  headlineAccent: {
    color: tokens.color.link,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    color: tokens.color.textMuted,
    fontWeight: "400",
  },
  actionsSection: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 14,
  },
  primaryEmailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tokens.color.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: tokens.color.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryEmailLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  primaryEmailText: {
    color: tokens.color.surfaceBrand,
    fontSize: 14.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.color.whiteA12,
    alignItems: "center",
    justifyContent: "center",
  },
  socialRow: {
    flexDirection: "row",
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: withAlpha(tokens.color.border, 0.9),
    paddingVertical: 13,
    borderRadius: 16,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  socialBtnText: {
    color: tokens.color.text,
    fontSize: 13.5,
    fontWeight: "600",
  },
  loginLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  loginLinkMuted: {
    color: tokens.color.textSubtle,
    fontSize: 13,
    fontWeight: "500",
  },
  loginLinkActive: {
    color: tokens.color.textBrand,
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  legalSection: {
    paddingHorizontal: 24,
    marginTop: 4,
  },
  legalText: {
    color: tokens.color.textSubtle,
    fontSize: 10.5,
    lineHeight: 15,
    textAlign: "center",
  },
  legalLink: {
    textDecorationLine: "underline",
    color: tokens.color.textBrand,
  },
});
