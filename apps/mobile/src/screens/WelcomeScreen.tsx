import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppleLogo, GoogleLogo, ArrowRightIcon, ExploreIcon } from "../components/Icons";

interface WelcomeScreenProps {
  onSelectAuth: (mode: "login" | "register" | "apple" | "google") => void;
}



const HERO_BG_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCaPLUeaEdYQRXIb63qG6CQVE5pIsJ3pdFATx3iB93-HGlrPZfQ6s64wc_Z7beqhxGveCM4xVoGOJBKUebET4EYp8dSe1Dg2hWdnn18naZZbABJb2nXG3uwSKtTfBPHJdai8N29ElVda23JdLDmPbm4iPlFjPrBVMJBKtDHTpEf1uY6S5_1DNw_u5WTbiGVIvbpmd-qgM8k8hOyziGwozLL1E7IH4cAF88BIHfe_c_Q4kH9d33y9Um3Pw";

export function WelcomeScreen({ onSelectAuth }: WelcomeScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0D281E" />
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
            colors={["rgba(13, 40, 30, 0.75)", "transparent", "#faf8ff"]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["transparent", "rgba(250, 248, 255, 0.85)", "#faf8ff"]}
            locations={[0.5, 0.82, 1]}
            style={styles.bottomBlendMask}
          />

          {/* Top Status & Brand Header Pill */}
          <View style={styles.headerBar}>
            <View style={styles.brandPill}>
              <View style={styles.brandIconCircle}>
                <ExploreIcon size={14} color="#0D281E" />
              </View>
              <Text style={styles.brandText}>MapsBridge</Text>
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
                      <Text style={styles.cardStatusAi}>AI CANLI ROTA</Text>
                      <Text style={styles.cardStatusDot}>•</Text>
                      <Text style={styles.cardStatusGps}>GPS Aktif</Text>
                    </View>
                    <Text style={styles.cardTitle}>Kapadokya Balon Vadisi</Text>
                  </View>
                </View>
                <View style={styles.savingsPill}>
                  <Text style={styles.savingsPillText}>⚡ 30 sn • %40 Tasarruf</Text>
                </View>
              </View>

              {/* Waypoints List */}
              <View style={styles.waypointsList}>
                {/* Connecting dashed line */}
                <View style={styles.timelineTrack} />

                {/* Stop 1 */}
                <View style={styles.waypointRow}>
                  <View style={styles.badge1}>
                    <Text style={styles.badge1Text}>1</Text>
                  </View>
                  <View style={styles.waypointInfo}>
                    <Text style={styles.waypointName} numberOfLines={1}>
                      Aşk Vadisi (Seyir Terası)
                    </Text>
                    <Text style={styles.waypointTime}>05:45 • Gün Doğumu & Balonlar</Text>
                  </View>
                  <View style={styles.distPill}>
                    <Text style={styles.distPillText}>1.8 km • ~12 dk</Text>
                  </View>
                </View>

                {/* Stop 2 */}
                <View style={styles.waypointRow}>
                  <View style={styles.badge2}>
                    <Text style={styles.badge2Text}>2</Text>
                  </View>
                  <View style={styles.waypointInfo}>
                    <Text style={styles.waypointName} numberOfLines={1}>
                      Göreme Açık Hava Müzesi
                    </Text>
                    <Text style={styles.waypointTimeDim}>07:15 • 4 Tarihi Durak</Text>
                  </View>
                  <View style={styles.distPillDim}>
                    <Text style={styles.distPillDimText}>2.4 km</Text>
                  </View>
                </View>

                {/* Stop 3 */}
                <View style={styles.waypointRow}>
                  <View style={styles.badge3}>
                    <Text style={styles.badge3Text}>🏁</Text>
                  </View>
                  <View style={styles.waypointInfo}>
                    <Text style={styles.waypointName} numberOfLines={1}>
                      Uçhisar Kalesi
                    </Text>
                    <Text style={styles.waypointTimeDim}>09:30 • Panoramik Gün Sonu</Text>
                  </View>
                  <View style={styles.distPillAccent}>
                    <Text style={styles.distPillAccentText}>Varış</Text>
                  </View>
                </View>
              </View>

              {/* Card Footer Bar */}
              <View style={styles.cardFooterBar}>
                <View style={styles.cardFooterStats}>
                  <Text style={styles.cardFooterStatPill}>📍 8 Durak</Text>
                  <Text style={styles.cardFooterStatPill}>🧭 5.1 km Toplam</Text>
                </View>
                <Text style={styles.cardFooterAction}>✨ AKILLI SIRALAMA</Text>
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

          <Text style={styles.headline}>
            Daha az planla,{"\n"}
            <Text style={styles.headlineAccent}>daha çok keşfet.</Text>
          </Text>

          <Text style={styles.subtitle}>
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
              <Text style={{ fontSize: 18 }}>✉️</Text>
              <Text style={styles.primaryEmailText}>E-posta ile Ücretsiz Başla</Text>
            </View>
            <View style={styles.arrowCircle}>
              <ArrowRightIcon size={14} color="#34D399" />
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
              <Text style={styles.socialBtnText}>Google</Text>
            </TouchableOpacity>

            {/* Apple */}
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => onSelectAuth("apple")}
              activeOpacity={0.85}
            >
              <AppleLogo size={18} color="#131b2e" />
              <Text style={styles.socialBtnText}>Apple</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign In Navigation Link */}
        <View style={styles.loginLinkRow}>
          <Text style={styles.loginLinkMuted}>Zaten hesabın var mı? </Text>
          <TouchableOpacity onPress={() => onSelectAuth("login")}>
            <Text style={styles.loginLinkActive}>Giriş Yap ➔</Text>
          </TouchableOpacity>
        </View>

        {/* Legal Footer */}
        <View style={styles.legalSection}>
          <Text style={styles.legalText}>
            Devam ederek <Text style={styles.legalLink}>Kullanım Şartları</Text> ve{" "}
            <Text style={styles.legalLink}>Gizlilik Politikası</Text>'nı onaylamış olursunuz.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#faf8ff",
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
    backgroundColor: "rgba(13, 40, 30, 0.72)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.25)",
  },
  brandIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#34D399",
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ECFDF5",
    letterSpacing: -0.2,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34D399",
    marginLeft: 2,
  },
  glassCardWrapper: {
    zIndex: 10,
    marginTop: 18,
  },
  glassCard: {
    borderRadius: 20,
    backgroundColor: "rgba(15, 41, 33, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    padding: 15,
    shadowColor: "#000",
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
    backgroundColor: "#34D399",
    shadowColor: "#34D399",
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
    color: "#34D399",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cardStatusDot: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 10,
  },
  cardStatusGps: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 10,
    fontWeight: "600",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: -0.2,
  },
  savingsPill: {
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  savingsPillText: {
    color: "#34D399",
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
    backgroundColor: "rgba(52, 211, 153, 0.35)",
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
    backgroundColor: "#34D399",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  badge1Text: {
    color: "#0D281E",
    fontSize: 11,
    fontWeight: "800",
  },
  badge2: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  badge2Text: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  badge3: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(16, 185, 129, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.5)",
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
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  waypointTime: {
    color: "rgba(52, 211, 153, 0.95)",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 1,
  },
  waypointTimeDim: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 1,
  },
  distPill: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  distPillText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  distPillDim: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  distPillDimText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 10,
    fontWeight: "600",
  },
  distPillAccent: {
    backgroundColor: "rgba(52, 211, 153, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.35)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  distPillAccentText: {
    color: "#34D399",
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
    borderTopColor: "rgba(255, 255, 255, 0.12)",
  },
  cardFooterStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardFooterStatPill: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 10,
    fontWeight: "600",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  cardFooterAction: {
    color: "#34D399",
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
    backgroundColor: "#013628",
  },
  progressDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#cbd5e1",
  },
  headline: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: "#013628",
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  headlineAccent: {
    color: "#286954",
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#404945",
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
    backgroundColor: "#013628",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: "#013628",
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
    color: "#ECFDF5",
    fontSize: 14.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
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
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    paddingVertical: 13,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  socialBtnText: {
    color: "#131b2e",
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
    color: "#717974",
    fontSize: 13,
    fontWeight: "500",
  },
  loginLinkActive: {
    color: "#013628",
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  legalSection: {
    paddingHorizontal: 24,
    marginTop: 4,
  },
  legalText: {
    color: "#717974",
    fontSize: 10.5,
    lineHeight: 15,
    textAlign: "center",
  },
  legalLink: {
    textDecorationLine: "underline",
    color: "#013628",
  },
});
