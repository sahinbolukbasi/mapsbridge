import React from "react";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";
import { iconPaths, iconStroke, type IconName } from "../theme/icon-paths";

// Tek ikon seti (design §4.2, R3): web `Icon` ile aynı ad, aynı path'ler (packages/design-tokens
// icons.ts → theme/icon-paths.ts, üretilmiş). Etiket yoksa dekoratiftir ve erişilebilirlik
// ağacından gizlenir; etiket verilirse image rolü + erişilebilir ad taşır.
export type { IconName };
export type IconSize = 16 | 20 | 24;

export interface IconProps {
  name: IconName;
  size?: IconSize;
  label?: string;
  /** Çizgi rengi (token); varsayılan tokens.color.text. */
  color?: string;
}

const STROKE: Partial<Record<IconName, number>> = iconStroke;

export function Icon({ name, size = 20, label, color = tokens.color.text }: IconProps) {
  const a11y = label
    ? { accessible: true, accessibilityRole: "image" as const, accessibilityLabel: label }
    : {
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants" as const,
      };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...a11y}>
      <Path
        d={iconPaths[name]}
        stroke={color}
        strokeWidth={STROKE[name] ?? iconStroke.default}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
