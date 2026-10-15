import React, { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  Animated,
  SafeAreaView,
  StatusBar,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";

import { ExploreIcon, MapIcon, LeafIcon, TreesIcon, SparkIcon, ShieldIcon } from "./Icons";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface SplashScreenProps {
  onFinish?: () => void;
  minDurationMs?: number;
}

const SPLASH_STEPS = [
  { text: "Gezgin rotaları ve düğümler taranıyor...", percent: 28 },
  { text: "Harita katmanları ve patikalar yükleniyor...", percent: 62 },
  { text: "Topluluk rotaları ve GPS optimize ediliyor...", percent: 88 },
  { text: "Keşif atlası hazır!", percent: 100 },
];

export function SplashScreen({ onFinish, minDurationMs = 1200 }: SplashScreenProps) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [percentDisplay, setPercentDisplay] = useState(15);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0.15)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for central badge
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Progress sequence
  useEffect(() => {
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < SPLASH_STEPS.length) {
        setCurrentStepIdx(step);
        const targetPercent = SPLASH_STEPS[step].percent;
        setPercentDisplay(targetPercent);
        Animated.timing(progressAnim, {
          toValue: targetPercent / 100,
          duration: 350,
          useNativeDriver: false,
        }).start();
      } else {
        clearInterval(interval);
        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }).start(() => {
            if (onFinish) onFinish();
          });
        }, 200);
      }
    }, minDurationMs / 3.5);

    return () => clearInterval(interval);
  }, []);

  const currentStep = SPLASH_STEPS[currentStepIdx] || SPLASH_STEPS[0];

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf8ff" />

      {/* Ambient background glows */}
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />

      <SafeAreaView style={styles.safeArea}>
        {/* Top Header Pills */}
        <View style={styles.topBar}>
          <View style={styles.liveBridgePill}>
            <View style={styles.pulsingLiveDot} />
            <Text style={styles.liveBridgeText}>CANLI KÖPRÜ MODU</Text>
          </View>

          <View style={styles.ecoPill}>
            <LeafIcon size={13} color="#286954" />
            <Text style={styles.ecoPillText}>Eco-Path Active</Text>
          </View>
        </View>

        {/* Center Hero Visual */}
        <View style={styles.centerHero}>
          <Animated.View style={[styles.logoWrap, { transform: [{ scale: pulseAnim }] }]}>
            {/* Outer Ring */}
            <View style={styles.logoOuterRing}>
              <View style={styles.logoInnerCircle}>
                <Svg width={48} height={48} viewBox="0 0 48 48">
                  <Path
                    d="M10 36C14 26 22 22 28 20C34 18 38 13 40 8"
                    stroke="rgba(255,255,255,0.4)"
                    strokeDasharray="3 3"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                  <Path
                    d="M8 38C15 28 25 24 32 22C38 20 40 12 40 12"
                    stroke="#10B981"
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                  <Circle cx="10" cy="36" r="3.5" fill="#34D399" />
                  <Circle cx="28" cy="22" r="3" fill="#ffffff" />
                  <Circle cx="39" cy="11" r="3.5" fill="#34D399" />
                  <Path
                    d="M24 10L25.8 15.2L31 17L25.8 18.8L24 24L22.2 18.8L17 17L22.2 15.2L24 10Z"
                    fill="#aef0d5"
                  />
                </Svg>
              </View>
            </View>

            {/* Route OS badge */}
            <View style={styles.routeOsBadge}>
              <Text style={styles.routeOsBadgeText}>ROUTE OS</Text>
            </View>
          </Animated.View>

          {/* Title & Slogan */}
          <View style={styles.titleBox}>
            <View style={styles.appNameRow}>
              <Text style={styles.appName}>MapsBridge</Text>
              <ExploreIcon size={24} color="#10B981" />
            </View>
            <Text style={styles.appTagline}>Akıllı Seyahat ve Keşif Ağı</Text>
          </View>

          {/* 3 Quick Stat Badges */}
          <View style={styles.statsRow}>
            <View style={styles.statBadge}>
              <MapIcon size={16} color="#05513d" />
              <Text style={styles.statLabel}>4.8K+ ROTA</Text>
            </View>
            <View style={styles.statBadge}>
              <TreesIcon size={16} color="#05513d" />
              <Text style={styles.statLabel}>%100 DOĞAL</Text>
            </View>
            <View style={styles.statBadge}>
              <SparkIcon size={16} color="#05513d" />
              <Text style={styles.statLabel}>ÇEVRİMDIŞI</Text>
            </View>
          </View>
        </View>

        {/* Bottom Loading Progress Card */}
        <View style={styles.bottomSection}>
          <View style={styles.progressCard}>
            <View style={styles.progressHeaderRow}>
              <View style={styles.progressStatusLeft}>
                <View style={styles.miniGreenPulse} />
                <Text style={styles.progressStatusText} numberOfLines={1}>
                  {currentStep.text}
                </Text>
              </View>
              <Text style={styles.progressPercentText}>{percentDisplay}%</Text>
            </View>

            {/* Track Bar */}
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>

            {/* Bottom info indicators */}
            <View style={styles.progressInfoRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <ExploreIcon size={12} color="#286954" />
                <Text style={styles.progressInfoLeft}>Topoğrafya Katmanı</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <SparkIcon size={12} color="#10B981" />
                <Text style={styles.progressInfoRight}>Çevrimdışı Düğümler</Text>
              </View>
            </View>
          </View>

          {/* Security & Version Footnote */}
          <View style={styles.footerNoteBox}>
            <View style={styles.securityRow}>
              <ShieldIcon size={14} color="#286954" />
              <Text style={styles.securityText}>MapsBridge Güvenli Bağlantı</Text>
            </View>
            <Text style={styles.versionText}>V2.4 • KEŞFETMEYE HAZIRLANIYOR</Text>
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#faf8ff",
    zIndex: 9999,
  },
  safeArea: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  glowTopRight: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(52, 211, 153, 0.18)",
  },
  glowBottomLeft: {
    position: "absolute",
    bottom: -50,
    left: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(1, 54, 40, 0.08)",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  liveBridgePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(234, 237, 255, 0.85)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    gap: 6,
  },
  pulsingLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  liveBridgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#404945",
    letterSpacing: 0.5,
  },
  ecoPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(236, 253, 245, 0.9)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    gap: 4,
  },
  ecoPillLeaf: {
    fontSize: 12,
  },
  ecoPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#286954",
  },
  centerHero: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoOuterRing: {
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: "#013628",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#013628",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },
  logoInnerCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#1e4d3e",
    alignItems: "center",
    justifyContent: "center",
  },
  routeOsBadge: {
    position: "absolute",
    bottom: -10,
    backgroundColor: "#013628",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#34D399",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  routeOsBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#aef0d5",
    letterSpacing: 1,
  },
  titleBox: {
    alignItems: "center",
    marginTop: 10,
  },
  appNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  appName: {
    fontSize: 32,
    fontWeight: "900",
    color: "#013628",
    letterSpacing: -0.5,
  },
  appIconCompass: {
    fontSize: 26,
  },
  appTagline: {
    fontSize: 14,
    color: "#717974",
    marginTop: 4,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
    width: "100%",
    maxWidth: 320,
    justifyContent: "center",
  },
  statBadge: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#404945",
    letterSpacing: 0.3,
  },
  bottomSection: {
    width: "100%",
    alignItems: "center",
    gap: 14,
    paddingBottom: 10,
  },
  progressCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#013628",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  progressHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progressStatusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  miniGreenPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  progressStatusText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#131b2e",
  },
  progressPercentText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#286954",
  },
  progressTrack: {
    width: "100%",
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#e2e7ff",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  progressInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  progressInfoLeft: {
    fontSize: 10,
    fontWeight: "600",
    color: "#286954",
  },
  progressInfoRight: {
    fontSize: 10,
    fontWeight: "600",
    color: "#10B981",
  },
  footerNoteBox: {
    alignItems: "center",
    gap: 4,
  },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  securityShield: {
    fontSize: 12,
  },
  securityText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#286954",
  },
  versionText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#717974",
    letterSpacing: 0.8,
  },
});
