import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fontFamily, letterSpacingPt, tokens } from "../theme";
import { Icon, type IconName } from "./Icon";
import { IconButton } from "./IconButton";
import { MIN_BUFFER_RATIO, dayColorIndex, formatMeters, formatMinutes } from "./logic/trip-format";
import { tr } from "../i18n/ui";

// Rota satırları (design §4.2): web StopRow / Connector / DayHeader ile aynı prop sözlüğü ve
// metinler; AccessibleStopList bu satırları kullanır. Numara hapı gün rengiyle (tokens.color.day1…7,
// beyaz numara ≥5:1), kategori İKONLA kodlanır (renk tek bilgi taşıyıcı değil, WCAG 1.4.1).
// `onMove` verilirse sürüklemenin erişilebilir alternatifi "Yukarı taşı / Aşağı taşı" düğmeleri
// çıkar (R9). Değer yoksa uydurulmaz (I1/I2): Connector "Süre hesaplanamadı" yazar.

const DAY_COLORS = [
  tokens.color.day1,
  tokens.color.day2,
  tokens.color.day3,
  tokens.color.day4,
  tokens.color.day5,
  tokens.color.day6,
  tokens.color.day7,
] as const;

/** Gün rengi (1…7 döner). */
export function dayColor(day: number): string {
  return DAY_COLORS[dayColorIndex(day) - 1];
}

export interface StopRowProps {
  /** 1'den başlayan gün içi sıra. */
  index: number;
  day: number;
  /** "09:00" gibi hazır saat metni. */
  time?: string;
  name: string;
  category: IconName;
  /** Kategori adı; görünür alt metin ve erişilebilir adın parçası. */
  categoryLabel?: string;
  /** Dakika. */
  duration?: number;
  selected?: boolean;
  onMove?: (direction: "up" | "down") => void;
  isFirst?: boolean;
  isLast?: boolean;
  /** Satıra dokunma (ör. haritada durağa odaklan). */
  onPress?: () => void;
  /** Erişilebilir adı tamamen değiştirir (varsayılan: "N. durak: Ad, kategori, süre"). */
  accessibilityLabel?: string;
}

export function StopRow({
  index,
  day,
  time,
  name,
  category,
  categoryLabel,
  duration,
  selected = false,
  onMove,
  isFirst = false,
  isLast = false,
  onPress,
  accessibilityLabel,
}: StopRowProps) {
  const label =
    accessibilityLabel ??
    [
      `${tr("trip.stop.label", { n: index })}: ${name}`,
      time,
      categoryLabel,
      duration !== undefined ? formatMinutes(duration) : undefined,
    ]
      .filter(Boolean)
      .join(", ");
  const body = (
    <>
      <View style={[styles.num, { backgroundColor: dayColor(day) }]}>
        <Text
          style={[styles.numText, { fontFamily: fontFamily("bold") }]}
          maxFontSizeMultiplier={tokens.font.maxScale.compact}
        >
          {index}
        </Text>
      </View>
      <View style={styles.body}>
        <Text
          style={[styles.name, { fontFamily: fontFamily("semibold") }]}
          maxFontSizeMultiplier={tokens.font.maxScale.body}
        >
          {name}
        </Text>
        <View style={styles.meta}>
          {time ? (
            <Text style={styles.metaText} maxFontSizeMultiplier={tokens.font.maxScale.body}>
              {time}
            </Text>
          ) : null}
          <Icon name={category} size={16} color={tokens.color.textMuted} />
          {categoryLabel ? (
            <Text style={styles.metaText} maxFontSizeMultiplier={tokens.font.maxScale.body}>
              {categoryLabel}
            </Text>
          ) : null}
          {duration !== undefined ? (
            <Text style={styles.metaText} maxFontSizeMultiplier={tokens.font.maxScale.body}>
              {formatMinutes(duration)}
            </Text>
          ) : null}
        </View>
      </View>
    </>
  );
  return (
    <View style={[styles.row, selected ? styles.selected : null]}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected }}
          style={({ pressed }) => [styles.main, pressed ? styles.pressed : null]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.main} accessible accessibilityLabel={label}>
          {body}
        </View>
      )}
      {onMove ? (
        <View style={styles.move}>
          <IconButton
            icon="chevron-up"
            label={`${tr("trip.stop.moveUp")}: ${name}`}
            disabled={isFirst}
            onPress={() => onMove("up")}
          />
          <IconButton
            icon="chevron"
            label={`${tr("trip.stop.moveDown")}: ${name}`}
            disabled={isLast}
            onPress={() => onMove("down")}
          />
        </View>
      ) : null}
    </View>
  );
}

export type ConnectorMode = "walk" | "drive" | "transit";
const MODE_ICON: Record<ConnectorMode, IconName> = {
  walk: "walk",
  drive: "drive",
  transit: "transit",
};

export interface ConnectorProps {
  mode: ConnectorMode;
  minutes?: number;
  meters?: number;
}

/** İki durak arası bağlantı: süre/mesafe yalnızca rota motorundan; yoksa "Süre hesaplanamadı". */
export function Connector({ mode, minutes, meters }: ConnectorProps) {
  let text: string;
  if (minutes === undefined) {
    text = tr("trip.connector.unknown");
  } else {
    const parts = [formatMinutes(minutes)];
    if (meters !== undefined) parts.push(formatMeters(meters));
    text = tr(`trip.connector.${mode}`, { value: parts.join(" · ") });
  }
  return (
    <View style={styles.connector} accessible accessibilityLabel={text}>
      <View style={styles.connectorLine} />
      <Icon name={MODE_ICON[mode]} size={16} color={tokens.color.textMuted} />
      <Text style={styles.connectorText} maxFontSizeMultiplier={tokens.font.maxScale.body}>
        {text}
      </Text>
    </View>
  );
}

export interface DayHeaderProps {
  title: string;
  eyebrow?: string;
  stops: number;
  meters?: number;
  minutes?: number;
  bufferRatio?: number;
  offline: boolean;
}

/**
 * Gün başlığı + toplamlar. Tampon rozeti yalnızca `bufferRatio` verilince (I10); %20'nin altında
 * uyarı tonu ve açıklayıcı metin (I9). Çevrimdışı rozeti yalnızca `offline` doğruysa.
 */
export function DayHeader({
  title,
  eyebrow,
  stops,
  meters,
  minutes,
  bufferRatio,
  offline,
}: DayHeaderProps) {
  const stopsText = tr("trip.day.stops", { n: stops });
  const pct = bufferRatio === undefined ? null : Math.round(bufferRatio * 100);
  const lowBuffer = bufferRatio !== undefined && bufferRatio < MIN_BUFFER_RATIO;
  return (
    <View style={styles.day}>
      {eyebrow ? (
        <Text style={styles.eyebrow} maxFontSizeMultiplier={tokens.font.maxScale.compact}>
          {eyebrow}
        </Text>
      ) : null}
      <Text
        accessibilityRole="header"
        style={[styles.dayTitle, { fontFamily: fontFamily("bold", "display") }]}
        maxFontSizeMultiplier={tokens.font.maxScale.compact}
      >
        {title}
      </Text>
      <View style={styles.pills}>
        <Pill icon="route">
          {meters === undefined ? stopsText : `${stopsText} · ${formatMeters(meters)}`}
        </Pill>
        {minutes !== undefined ? (
          <Pill icon="clock">{tr("trip.unit.approx", { value: formatMinutes(minutes) })}</Pill>
        ) : null}
        {pct !== null ? (
          <Pill tone={lowBuffer ? "warning" : "success"}>
            {tr(lowBuffer ? "trip.day.bufferLow" : "trip.day.buffer", { n: pct })}
          </Pill>
        ) : null}
        {offline ? <Pill icon="offline">{tr("trip.day.offline")}</Pill> : null}
      </View>
    </View>
  );
}

const PILL_TONE = {
  neutral: { bg: tokens.color.badgeNeutralBg, fg: tokens.color.badgeNeutralFg },
  success: { bg: tokens.color.badgeSuccessBg, fg: tokens.color.badgeSuccessFg },
  warning: { bg: tokens.color.badgeWarningBg, fg: tokens.color.badgeWarningFg },
} as const;

function Pill({
  icon,
  tone = "neutral",
  children,
}: {
  icon?: IconName;
  tone?: keyof typeof PILL_TONE;
  children: string;
}) {
  const t = PILL_TONE[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      {icon ? <Icon name={icon} size={16} color={t.fg} /> : null}
      <Text
        style={[styles.pillText, { color: t.fg, fontFamily: fontFamily("medium") }]}
        maxFontSizeMultiplier={tokens.font.maxScale.compact}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: tokens.color.stopBorder,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.stopBg,
  },
  selected: { borderColor: tokens.color.stopSelectedBorder, borderWidth: 2 },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["3"],
    minHeight: tokens.touch.min,
    paddingHorizontal: tokens.space["3"],
    paddingVertical: tokens.space["2"],
  },
  pressed: { opacity: 0.85 },
  num: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  numText: {
    color: tokens.color.onDay,
    fontSize: tokens.font.size.sm,
    fontWeight: tokens.font.weight.bold,
  },
  body: { flex: 1, gap: 2 },
  name: {
    fontSize: tokens.font.size.base,
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tokens.space["1"] },
  metaText: { fontSize: tokens.font.size.xs, color: tokens.color.textMuted },
  move: { flexDirection: "row" },
  connector: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["2"],
    paddingLeft: tokens.space["4"],
    paddingVertical: tokens.space["1"],
  },
  connectorLine: {
    width: 2,
    alignSelf: "stretch",
    minHeight: tokens.space["4"],
    backgroundColor: tokens.color.connector,
  },
  connectorText: { fontSize: tokens.font.size.xs, color: tokens.color.textMuted },
  day: { gap: tokens.space["1"] },
  eyebrow: {
    fontSize: tokens.font.size.xs,
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.textSubtle,
    textTransform: "uppercase",
    letterSpacing: letterSpacingPt(tokens.letterSpacing.caps, tokens.font.size.xs),
  },
  dayTitle: {
    fontSize: tokens.font.size.lg,
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.text,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["1"],
    paddingHorizontal: tokens.space["2"],
    paddingVertical: 2,
    borderRadius: tokens.radius.full,
  },
  pillText: { fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.medium },
});
