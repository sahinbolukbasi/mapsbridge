import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,
} from "react-native";
import { storage } from "../services/storage";
import {
  MapIcon,
  PlanIcon,
  SparkIcon,
  RobotIcon,
  ExploreIcon,
  UserIcon,
  PinIcon,
  DirectionsIcon,
  Share2Icon,
  LightbulbIcon,
} from "./Icons";

import { tokens, withAlpha } from "../theme";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type TourScreenType = "map" | "plan" | "ai" | "community" | "profile";

interface TourStep {
  icon: (color: string) => React.ReactNode;
  title: string;
  desc: string;
}

interface TourContent {
  title: string;
  badge: string;
  subtitle: string;
  steps: TourStep[];
  tip: string;
}

const TOURS: Record<TourScreenType, TourContent> = {
  map: {
    badge: "HARİTA MASASI",
    title: "Canlı Harita ve Keşif Alanı",
    subtitle:
      "Dünyanın dört bir yanındaki durakları canlı harita üzerinde milimetrik olarak yönetin.",
    steps: [
      {
        icon: (c) => <PinIcon size={20} color={c} />,
        title: "Mekanlara Dokun ve Ekle",
        desc: "Haritadaki herhangi bir mekana veya konuma dokunarak anında rota havuzunuza ekleyebilirsiniz.",
      },
      {
        icon: (c) => <DirectionsIcon size={20} color={c} />,
        title: "Akıllı Yürüme ve Ulaşım Takibi",
        desc: "Duraklar arası yürüyüş süresi, mesafe ve yükseklik eğimi otomatik hesaplanır.",
      },
      {
        icon: (c) => <Share2Icon size={20} color={c} />,
        title: "6 Haneli Canlı Paylaşım Kodu",
        desc: "Rotanızı tek tıkla arkadaşlarınızla veya web harita masasıyla senkronize edin.",
      },
    ],
    tip: "İpucu: Alttaki kartı yukarı kaydırarak tüm durakları liste halinde inceleyebilirsiniz.",
  },
  plan: {
    badge: "ROTA PLANI",
    title: "Gün Gün Seyahat Mimariniz",
    subtitle: "Duraklarınızı düzenleyin, sıralayın ve tek tıkla rotanızı optimize edin.",
    steps: [
      {
        icon: (c) => <PlanIcon size={20} color={c} />,
        title: "Zahmetsiz Rota Oluşturma",
        desc: "Hiç rotanız yoksa hazır şablonlarla başlayabilir veya haritadan adım adım ekleyebilirsiniz.",
      },
      {
        icon: (c) => <MapIcon size={20} color={c} />,
        title: "Haritadan Doğrudan Seçim",
        desc: '"Durak Ekle" butonuna bastığınızda harita açılır ve yer seçmeniz sağlanır.',
      },
      {
        icon: (c) => <SparkIcon size={20} color={c} />,
        title: "Yol Optimizasyonu",
        desc: '"Rotayı Optimize Et" ile çapraz geçişleri sıfırlayarak %38 zaman tasarrufu yapın.',
      },
    ],
    tip: "İpucu: Ziyaret ettiğiniz durakların yanındaki onay kutusuna dokunarak durumu güncelleyin.",
  },
  ai: {
    badge: "AI ASİSTAN",
    title: "Akıllı Seyahat Yol Arkadaşınız",
    subtitle:
      "Hayalinizdeki geziyi anlatın, MapsBridge AI size doğrulanmış duraklarla rota çizsin.",
    steps: [
      {
        icon: (c) => <RobotIcon size={20} color={c} />,
        title: "Doğal Dilde Rota Talebi",
        desc: '"Roma\'da 3 gün sanat ve kahve" gibi dilediğiniz tempoda istek yazabilirsiniz.',
      },
      {
        icon: (c) => <SparkIcon size={20} color={c} />,
        title: "Sıfır Halüsinasyon Mekanlar",
        desc: "Tüm öneriler coğrafi koordinat ve güncel açılış saatleriyle haritaya yerleşir.",
      },
      {
        icon: (c) => <PlanIcon size={20} color={c} />,
        title: "Tek Tıkla Plana Aktarma",
        desc: "Beğendiğiniz AI planını tek butonla ana harita ve planınıza aktarabilirsiniz.",
      },
    ],
    tip: "İpucu: Bütçenizi ve yürüyüş temponuzu belirterek daha hassas rotalar alabilirsiniz.",
  },
  community: {
    badge: "TOPLULUK",
    title: "Gezginlerden Gerçek Deneyimler",
    subtitle:
      "Dünyanın dört bir yanından gezginlerin paylaştığı keşifleri ve saha fotoğraflarını inceleyin.",
    steps: [
      {
        icon: (c) => <ExploreIcon size={20} color={c} />,
        title: "Özgün Seyahat Gönderileri",
        desc: "Diğer gezginlerin durak notlarını, fotoğraflarını ve önerilerini keşfedin.",
      },
      {
        icon: (c) => <PinIcon size={20} color={c} />,
        title: "Rotaları Kendi Planına Al",
        desc: "Beğendiğiniz rotaları tek dokunuşla kendi seyahat havuzunuza kopyalayabilirsiniz.",
      },
    ],
    tip: "İpucu: Kendi keşiflerinizi de toplulukla paylaşarak diğer gezginlere ilham verebilirsiniz.",
  },
  profile: {
    badge: "PROFİL & AYARLAR",
    title: "Kişisel Seyahat Kontrol Merkezi",
    subtitle: "Kayıtlı rotalarınız, çevrimdışı arşiviniz ve hesap ayarlarınız tek yerde.",
    steps: [
      {
        icon: (c) => <UserIcon size={20} color={c} />,
        title: "Çoklu Cihaz Senkronizasyonu",
        desc: "Web ve mobil hesaplarınız tek kullanıcı kimliği altında eşzamanlı çalışır.",
      },
      {
        icon: (c) => <Share2Icon size={20} color={c} />,
        title: "Çevrimdışı Rota Erişimi",
        desc: "İnternetiniz olmasa bile kayıtlı rotalarınıza ve durak detaylarınıza erişin.",
      },
    ],
    tip: "İpucu: Profilinizi güncelleyerek seyahat ilgi alanlarınızı belirleyebilirsiniz.",
  },
};

interface ScreenTourModalProps {
  screen: TourScreenType;
  visible?: boolean;
  onClose?: () => void;
  autoCheckStorage?: boolean;
}

export function ScreenTourModal({
  screen,
  visible: controlledVisible,
  onClose,
  autoCheckStorage = true,
}: ScreenTourModalProps) {
  const [internalVisible, setInternalVisible] = useState(false);

  useEffect(() => {
    if (controlledVisible !== undefined) {
      setInternalVisible(controlledVisible);
      return;
    }

    if (autoCheckStorage) {
      const checkSeen = async () => {
        try {
          const key = `mb_tour_seen_${screen}`;
          const seen = await storage.getItem(key);
          if (!seen) {
            // Give screen a moment to settle before showing guide
            setTimeout(() => {
              setInternalVisible(true);
            }, 350);
          }
        } catch {
          // Fallback ignore
        }
      };
      checkSeen();
    }
  }, [screen, controlledVisible, autoCheckStorage]);

  const handleDismiss = async () => {
    setInternalVisible(false);
    try {
      await storage.setItem(`mb_tour_seen_${screen}`, "true");
    } catch {}
    onClose?.();
  };

  const content = TOURS[screen];
  if (!content) return null;

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Close button top right */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleDismiss}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header Badge */}
            <View style={styles.badgeRow}>
              <View style={styles.pulsingDot} />
              <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.badgeText}>{content.badge}</Text>
            </View>

            {/* Title & Subtitle */}
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.title}>{content.title}</Text>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.subtitle}>{content.subtitle}</Text>

            {/* Feature Steps */}
            <View style={styles.stepsContainer}>
              {content.steps.map((step, idx) => (
                <View key={idx} style={styles.stepCard}>
                  <View style={styles.stepIconWrap}>{step.icon(tokens.color.accent)}</View>
                  <View style={styles.stepTextContainer}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.stepTitle}>{step.title}</Text>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Helpful Tip Box */}
            <View style={styles.tipBox}>
              <View style={styles.tipIconWrap}>
                <LightbulbIcon size={16} color={tokens.color.warningStrong} />
              </View>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.tipText}>{content.tip}</Text>
            </View>

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleDismiss}
              activeOpacity={0.85}
            >
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.primaryBtnText}>Anladım, Keşfe Başla</Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.primaryBtnArrow}>➔</Text>
            </TouchableOpacity>

            {/* Dismiss without seeing again */}
            <TouchableOpacity style={styles.skipBtn} onPress={handleDismiss} activeOpacity={0.7}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.skipBtnText}>Tanıtımı Kapat</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: withAlpha(tokens.color.surfaceInverseStrong, 0.78),
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  container: {
    width: Math.min(SCREEN_WIDTH - 36, 420),
    maxHeight: "88%",
    backgroundColor: tokens.color.surfaceInverse,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: tokens.color.brandHover,
    overflow: "hidden",
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 20,
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.color.whiteA08,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    color: tokens.color.neutral400,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: withAlpha(tokens.color.accent, 0.12),
    borderWidth: 1,
    borderColor: tokens.color.accentA30,
    marginBottom: 12,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.color.accent,
  },
  badgeText: {
    color: tokens.color.accentStrong,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: tokens.color.onPrimary,
    letterSpacing: -0.4,
    marginBottom: 6,
    paddingRight: 24,
  },
  subtitle: {
    fontSize: 13.5,
    color: tokens.color.neutral400,
    lineHeight: 20,
    marginBottom: 20,
  },
  stepsContainer: {
    gap: 12,
    marginBottom: 18,
  },
  stepCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: withAlpha(tokens.color.surface, 0.035),
    borderWidth: 1,
    borderColor: withAlpha(tokens.color.neutral0, 0.06),
  },
  stepIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: withAlpha(tokens.color.accent, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(tokens.color.accent, 0.25),
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.color.neutral200,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 12.5,
    color: tokens.color.neutral400,
    lineHeight: 18,
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: withAlpha(tokens.color.warningStrong, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(tokens.color.warningStrong, 0.25),
    marginBottom: 22,
  },
  tipIconWrap: {
    marginTop: 1,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: tokens.color.warningBorder,
    lineHeight: 17,
    fontWeight: "500",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: tokens.color.accent,
    shadowColor: tokens.color.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  primaryBtnArrow: {
    color: tokens.color.onPrimary,
    fontSize: 14,
    fontWeight: "900",
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  skipBtnText: {
    color: tokens.color.textSubtle,
    fontSize: 12.5,
    fontWeight: "600",
  },
});
