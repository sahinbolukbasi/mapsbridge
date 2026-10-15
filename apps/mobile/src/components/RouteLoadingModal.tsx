import React from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import Svg, { Path, Circle, Defs, Pattern, Rect, Text as SvgText, G } from "react-native-svg";

interface RouteLoadingModalProps {
  visible: boolean;
  onCancel?: () => void;
  onRunInBackground?: () => void;
  progressPercent?: number;
  routeTitle?: string;
}

export function RouteLoadingModal({
  visible,
  onCancel,
  onRunInBackground,
  progressPercent = 64,
  routeTitle = "Rotanız Haritaya İşleniyor",
}: RouteLoadingModalProps) {
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.safeContainer}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Minimal Header / Cancellation Bar */}
          <View style={styles.headerBar}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconCircle}>
                <Text style={{ fontSize: 16 }}>🧭</Text>
              </View>
              <View>
                <Text style={styles.headerTitle}>MapsBridge</Text>
                <Text style={styles.headerSub}>ROTA MOTORU 4.2</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Vazgeç</Text>
              <Text style={styles.cancelBtnCross}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Central Optimization & Radar Visual Card */}
          <View style={styles.radarCard}>
            <View style={styles.ambientGlow} />

            {/* Radar / Spline Graphic */}
            <View style={styles.radarGraphicBox}>
              <Svg width="100%" height={140} viewBox="0 0 320 140">
                {/* Trail Path */}
                <Path
                  d="M 30,110 C 70,120 100,40 160,50 C 220,60 240,110 290,30"
                  stroke="#10B981"
                  strokeDasharray="6 6"
                  strokeLinecap="round"
                  strokeWidth={3}
                  fill="none"
                />
                {/* Waypoint 1 (Completed) */}
                <Circle cx={30} cy={110} r={7} fill="#013628" />
                <Circle cx={30} cy={110} r={3} fill="#ffffff" />
                <SvgText x={16} y={130} fill="#286954" fontSize="10" fontWeight="bold">
                  Karaköy
                </SvgText>

                {/* Waypoint 2 (Active Scan Node) */}
                <G>
                  <Circle cx={160} cy={50} r={14} fill="rgba(16, 185, 129, 0.25)" />
                  <Circle cx={160} cy={50} r={8} fill="#10B981" />
                  <Circle cx={160} cy={50} r={3.5} fill="#ffffff" />
                  <SvgText x={126} y={30} fill="#0D281E" fontSize="10" fontWeight="bold">
                    Galata Kulesi
                  </SvgText>
                </G>

                {/* Waypoint 3 (Pending Node) */}
                <Circle cx={290} cy={30} r={6} fill="#c0c8c3" />
                <Circle cx={290} cy={30} r={2.5} fill="#ffffff" />
                <SvgText x={245} y={18} fill="#717974" fontSize="10" fontWeight="bold">
                  İstiklal Cad.
                </SvgText>
              </Svg>

              {/* Live Radar Ping Indicator */}
              <View style={styles.liveOptimizationBadge}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveOptimizationText}>Canlı Optimizasyon</Text>
              </View>

              {/* Percentage Float */}
              <View style={styles.percentBadge}>
                <Text style={styles.percentNum}>{progressPercent}%</Text>
                <Text style={styles.percentLabel}>HESAPLANDI</Text>
              </View>
            </View>

            {/* Title & Context */}
            <View style={styles.cardTextBox}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle}>{routeTitle}</Text>
                <Text style={styles.syncSpin}>🔄</Text>
              </View>
              <Text style={styles.cardDesc}>
                Yapay zeka durak sıralamasını, eğim analizini ve çevrimdışı yürüyüş verilerini
                optimize ediyor.
              </Text>
            </View>

            {/* Step Progress Tracker Milestones */}
            <View style={styles.milestonesList}>
              {/* Step 1 */}
              <View style={styles.milestoneItem}>
                <View style={styles.stepIndicatorCol}>
                  <View style={[styles.stepCircle, styles.stepCircleCompleted]}>
                    <Text style={styles.stepCheck}>✓</Text>
                  </View>
                  <View style={[styles.stepConnector, { backgroundColor: "#10B981" }]} />
                </View>
                <View style={styles.stepInfo}>
                  <View style={styles.stepHeaderRow}>
                    <Text style={styles.stepTitle}>GPS Koordinatları & Duraklar</Text>
                    <View style={styles.completedTag}>
                      <Text style={styles.completedTagText}>Tamamlandı</Text>
                    </View>
                  </View>
                  <Text style={styles.stepDesc}>
                    İlgi noktaları ve ara mola noktaları doğrulandı.
                  </Text>
                </View>
              </View>

              {/* Step 2 */}
              <View style={styles.milestoneItem}>
                <View style={styles.stepIndicatorCol}>
                  <View style={[styles.stepCircle, styles.stepCircleActive]}>
                    <Text style={{ fontSize: 11, color: "#fff" }}>⚡</Text>
                  </View>
                  <View style={styles.stepConnector} />
                </View>
                <View style={styles.stepInfo}>
                  <View style={styles.stepHeaderRow}>
                    <Text style={[styles.stepTitle, { fontWeight: "800" }]}>
                      En Hızlı Yürüyüş Yolu Analizi
                    </Text>
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>İşleniyor</Text>
                    </View>
                  </View>
                  <Text style={styles.stepDesc}>
                    Trafik, yaya kalabalığı ve güncel yol çalışmaları taranıyor.
                  </Text>
                </View>
              </View>

              {/* Step 3 */}
              <View style={[styles.milestoneItem, { opacity: 0.65 }]}>
                <View style={styles.stepIndicatorCol}>
                  <View style={styles.stepCircle}>
                    <Text style={{ fontSize: 10, color: "#717974" }}>⏳</Text>
                  </View>
                  <View style={styles.stepConnector} />
                </View>
                <View style={styles.stepInfo}>
                  <View style={styles.stepHeaderRow}>
                    <Text style={styles.stepTitle}>Kaşif Notları & Yerel İpuçları</Text>
                    <View style={styles.pendingTag}>
                      <Text style={styles.pendingTagText}>Sırada</Text>
                    </View>
                  </View>
                  <Text style={styles.stepDesc}>
                    Gizli sokak lezzetleri ve manzara seyir noktaları eklenecek.
                  </Text>
                </View>
              </View>

              {/* Step 4 */}
              <View style={[styles.milestoneItem, { opacity: 0.45 }]}>
                <View style={styles.stepIndicatorCol}>
                  <View style={styles.stepCircle}>
                    <Text style={{ fontSize: 10, color: "#717974" }}>☁️</Text>
                  </View>
                </View>
                <View style={styles.stepInfo}>
                  <View style={styles.stepHeaderRow}>
                    <Text style={styles.stepTitle}>Çevrimdışı Harita Hazırlığı</Text>
                    <View style={styles.pendingTag}>
                      <Text style={styles.pendingTagText}>Bekliyor</Text>
                    </View>
                  </View>
                  <Text style={styles.stepDesc}>
                    Sinyalsiz dağ ve ara sokak moduna uygun paketleniyor.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Travel Tip Banner */}
          <View style={styles.tipBanner}>
            <View style={styles.tipIconWrap}>
              <Text style={{ fontSize: 16 }}>💡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipHeading}>Gezgin İpucu</Text>
              <Text style={styles.tipBody}>
                MapsBridge ile oluşturulan rotaları internet bağlantınız kesildiğinde de GPS
                üzerinden rota sapması uyarısıyla kullanabilirsiniz.
              </Text>
            </View>
          </View>

          {/* Action CTA Area */}
          <TouchableOpacity
            style={styles.backgroundCtaBtn}
            onPress={onRunInBackground || onCancel}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16 }}>🔔</Text>
            <Text style={styles.backgroundCtaText}>Arka Planda Yükle ve Bildir</Text>
          </TouchableOpacity>
          <Text style={styles.footnote}>ROTA HAZIRLANDIĞINDA TİTREŞİMLİ BİLDİRİM GÖNDERİLİR</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: "#faf8ff",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1e4d3e",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#013628",
  },
  headerSub: {
    fontSize: 10,
    fontWeight: "800",
    color: "#286954",
    letterSpacing: 0.8,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eaedff",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#404945",
  },
  cancelBtnCross: {
    fontSize: 11,
    color: "#717974",
  },
  radarCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 18,
    shadowColor: "#013628",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    overflow: "hidden",
  },
  ambientGlow: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(52, 211, 153, 0.12)",
  },
  radarGraphicBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    marginBottom: 16,
  },
  liveOptimizationBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    gap: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  liveOptimizationText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#286954",
  },
  percentBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  percentNum: {
    fontSize: 16,
    fontWeight: "900",
    color: "#013628",
  },
  percentLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: "#717974",
  },
  cardTextBox: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#013628",
  },
  syncSpin: {
    fontSize: 16,
  },
  cardDesc: {
    fontSize: 12,
    color: "#717974",
    lineHeight: 18,
  },
  milestonesList: {
    gap: 12,
  },
  milestoneItem: {
    flexDirection: "row",
    gap: 12,
  },
  stepIndicatorCol: {
    alignItems: "center",
    width: 26,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#eaedff",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleCompleted: {
    backgroundColor: "#ecfdf5",
  },
  stepCircleActive: {
    backgroundColor: "#013628",
  },
  stepCheck: {
    fontSize: 12,
    fontWeight: "900",
    color: "#10B981",
  },
  stepConnector: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: "#e2e8f0",
    marginVertical: 2,
  },
  stepInfo: {
    flex: 1,
  },
  stepHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#013628",
  },
  completedTag: {
    backgroundColor: "#ecfdf5",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  completedTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#286954",
  },
  activeTag: {
    backgroundColor: "#abedd3",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  activeTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#005236",
  },
  pendingTag: {
    backgroundColor: "#f2f3ff",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  pendingTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#717974",
  },
  stepDesc: {
    fontSize: 11,
    color: "#717974",
  },
  tipBanner: {
    backgroundColor: "#ecfdf5",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    gap: 12,
  },
  tipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  tipHeading: {
    fontSize: 12,
    fontWeight: "800",
    color: "#013628",
    marginBottom: 2,
  },
  tipBody: {
    fontSize: 11,
    color: "#286954",
    lineHeight: 16,
  },
  backgroundCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  backgroundCtaText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#013628",
  },
  footnote: {
    textAlign: "center",
    fontSize: 9,
    fontWeight: "800",
    color: "#717974",
    letterSpacing: 0.6,
  },
});
