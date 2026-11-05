// OTOMATİK ÜRETİLDİ — packages/design-tokens. Elle düzenleme. `npm run tokens:build`
// React Native teması. Renkler çözülmüş hex/rgba; RN CSS karışımlarını ve değişken referanslarını desteklemez.

export const tokens = {
  color: {
    bg: "#faf7f0",
    surface: "#fffdf8",
    surfaceSunken: "#f2ede2",
    surfaceTint: "#f2ede2",
    surfaceBrand: "#ecfdf5",
    surfaceBrandStrong: "#d1fae5",
    onSurfaceBrand: "#065f46",
    surfaceInverse: "#1b2420",
    surfaceInverseStrong: "#020e0a",
    text: "#1b2420",
    textMuted: "#3f4843",
    textSubtle: "#5f6762",
    textInverse: "#faf7f0",
    textInverseMuted: "#e4dccb",
    textInverseSubtle: "#94a3b8",
    textBrand: "#013628",
    textInverseBrand: "#a0d1bd",
    surfaceBrandSoft: "#abedd3",
    brand: "#286954",
    brandHover: "#1e4d3e",
    link: "#286954",
    linkHover: "#013628",
    linkInverse: "#34d399",
    linkInverseHover: "#abedd3",
    primary: "#013628",
    primaryHover: "#1e4d3e",
    primaryActive: "#0d281e",
    onPrimary: "#ffffff",
    accent: "#10b981",
    accentStrong: "#34d399",
    onAccent: "#0d281e",
    accentSky: "#0284c7",
    accentSkySoft: "#38bdf8",
    textAccent: "#047857",
    accentA10: "rgba(16, 185, 129, 0.1)",
    accentA20: "rgba(16, 185, 129, 0.2)",
    accentA30: "rgba(16, 185, 129, 0.3)",
    whiteA08: "rgba(255, 255, 255, 0.08)",
    whiteA12: "rgba(255, 255, 255, 0.12)",
    neutral0: "#ffffff",
    neutral50: "#f8fafc",
    neutral100: "#f1f5f9",
    neutral200: "#e2e8f0",
    neutral300: "#cbd5e1",
    neutral400: "#94a3b8",
    neutral500: "#64748b",
    neutral600: "#404945",
    neutral700: "#334155",
    neutral800: "#1e293b",
    neutral900: "#0f172a",
    border: "#e4dccb",
    borderSubtle: "rgba(226, 232, 240, 0.85)",
    borderControl: "#5f6762",
    borderStrong: "#cfc4ad",
    success: "#047857",
    successStrong: "#059669",
    successBg: "#ecfdf5",
    successBorder: "#abedd3",
    warning: "#92400e",
    warningBg: "#fffbeb",
    warningBgStrong: "#fef3c7",
    warningBorder: "#fde68a",
    warningIcon: "#f59e0b",
    warningStrong: "#b45309",
    danger: "#b91c1c",
    dangerBg: "#fef2f2",
    dangerBorder: "#fecaca",
    dangerSolid: "#b91c1c",
    dangerIcon: "#ef4444",
    info: "#1d4ed8",
    infoBg: "#eff6ff",
    infoBorder: "#bfdbfe",
    infoIcon: "#3b82f6",
    exampleBg: "#fffbeb",
    exampleFg: "#92400e",
    exampleBorder: "#fde68a",
    highlight: "#b4502b",
    highlightText: "#9a3f1e",
    highlightBg: "#fbece4",
    highlightBgStrong: "#f6d9ca",
    textInverseHighlight: "#f2b59b",
    day1: "#013628",
    day2: "#b4502b",
    day3: "#2f6f8f",
    day4: "#7a3e8e",
    day5: "#5b6b1f",
    day6: "#a2324f",
    day7: "#8a5a00",
    onDay: "#ffffff",
    mapRoute: "#2563eb",
    mapRouteCasing: "#fffdf8",
    focusRingColor: "#013628",
    focusRingColorInverse: "#34d399",
    scrim: "rgba(0, 0, 0, 0.45)",
    buttonPrimaryBg: "#013628",
    buttonPrimaryBgHover: "#1e4d3e",
    buttonPrimaryFg: "#ffffff",
    buttonBrandBg: "#286954",
    buttonBrandBgHover: "#1e4d3e",
    buttonBrandFg: "#ffffff",
    buttonSecondaryBg: "#fffdf8",
    buttonSecondaryBgHover: "#f2ede2",
    buttonSecondaryFg: "#1b2420",
    buttonSecondaryBorder: "#5f6762",
    buttonGhostBgHover: "#f2ede2",
    buttonGhostFg: "#1b2420",
    buttonGhostBorder: "#5f6762",
    buttonDangerBg: "#b91c1c",
    buttonDangerFg: "#ffffff",
    buttonLinkFg: "#286954",
    buttonLinkFgHover: "#013628",
    cardBg: "#fffdf8",
    cardFg: "#1b2420",
    cardBorder: "#e4dccb",
    cardInverseBg: "#1b2420",
    cardInverseBorder: "rgba(255, 255, 255, 0.12)",
    fieldBg: "#fffdf8",
    fieldFg: "#1b2420",
    fieldPlaceholder: "#3f4843",
    fieldBorder: "#5f6762",
    fieldBorderInvalid: "#b91c1c",
    checkBoxBg: "#fffdf8",
    checkBoxBorder: "#5f6762",
    checkMark: "#013628",
    alertInfoBg: "#eff6ff",
    alertInfoBorder: "#bfdbfe",
    alertInfoAccent: "#1d4ed8",
    alertSuccessBg: "#ecfdf5",
    alertSuccessBorder: "#abedd3",
    alertSuccessAccent: "#047857",
    alertWarningBg: "#fffbeb",
    alertWarningBorder: "#fde68a",
    alertWarningAccent: "#92400e",
    alertDangerBg: "#fef2f2",
    alertDangerBorder: "#fecaca",
    alertDangerAccent: "#b91c1c",
    alertFg: "#1b2420",
    toastBg: "#fffdf8",
    toastFg: "#1b2420",
    toastBorder: "#e4dccb",
    badgeNeutralBg: "#f2ede2",
    badgeNeutralFg: "#3f4843",
    badgeBrandBg: "#d1fae5",
    badgeBrandFg: "#065f46",
    badgeSuccessBg: "#ecfdf5",
    badgeSuccessFg: "#047857",
    badgeWarningBg: "#fef3c7",
    badgeWarningFg: "#92400e",
    badgeDangerBg: "#fef2f2",
    badgeDangerFg: "#b91c1c",
    badgeInfoBg: "#eff6ff",
    badgeInfoFg: "#1d4ed8",
    badgeExampleBg: "#fffbeb",
    badgeExampleFg: "#92400e",
    badgeHighlightBg: "#fbece4",
    badgeHighlightFg: "#9a3f1e",
    tabsBg: "#fffdf8",
    tabsFg: "#3f4843",
    tabsFgSelected: "#013628",
    tabsIndicator: "#013628",
    paginationBg: "#fffdf8",
    paginationFg: "#1b2420",
    paginationBorder: "#5f6762",
    paginationCurrentBg: "#013628",
    paginationCurrentFg: "#ffffff",
    tableBg: "#fffdf8",
    tableFg: "#1b2420",
    tableHeadBg: "#f2ede2",
    tableHeadFg: "#3f4843",
    tableBorder: "#e4dccb",
    modalBg: "#fffdf8",
    modalFg: "#1b2420",
    modalScrim: "rgba(0, 0, 0, 0.45)",
    avatarBg: "#d1fae5",
    avatarFg: "#065f46",
    skeletonBg: "#f2ede2",
    chipBg: "#fffdf8",
    chipFg: "#1b2420",
    chipBorder: "#5f6762",
    chipSelectedBg: "#013628",
    chipSelectedFg: "#ffffff",
    segmentBg: "#f2ede2",
    segmentFg: "#3f4843",
    segmentSelectedBg: "#fffdf8",
    segmentSelectedFg: "#1b2420",
    sheetBg: "#fffdf8",
    sheetHandle: "#cfc4ad",
    stopBg: "#fffdf8",
    stopBorder: "#e4dccb",
    stopSelectedBorder: "#013628",
    connector: "#cfc4ad",
    costBg: "#fbece4",
    costFg: "#9a3f1e",
    composerBg: "#fffdf8",
    composerBorder: "#5f6762",
    black: "#000000"
  },
  dataPalette: {
    blue: "#2563eb",
    emerald: "#10b981",
    violet: "#8b5cf6",
    orange: "#f97316",
    pink: "#ec4899",
    cyan: "#06b6d4",
    yellow: "#eab308",
    red: "#ef4444",
    indigo: "#6366f1",
    teal: "#14b8a6",
    "blue-light": "#3b82f6",
    green: "#16a34a",
    purple: "#a855f7",
    "orange-deep": "#ea580c",
    amber: "#b45309",
    slate: "#64748b"
  },
  thirdParty: {
    "google-blue": "#4285f4",
    "google-green": "#34a853",
    "google-yellow": "#fbbc05",
    "google-red": "#ea4335",
    "google-blue-hover": "#3367d6",
    whatsapp: "#25d366",
    yandex: "#fc3f1d",
    stripe: "#635bff"
  },
  space: {
    "0": 0,
    "1": 4,
    "2": 8,
    "3": 12,
    "4": 16,
    "5": 20,
    "6": 24,
    "8": 32,
    "10": 40,
    "12": 48,
    "16": 64,
    "20": 80
  },
  radius: {
    xs: 4,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 9999
  },
  font: {
    family: {
      sans: "Inter",
      display: "PlusJakartaSans"
    },
    size: {
      "2xs": 11,
      xs: 12,
      sm: 13,
      md: 14,
      base: 16,
      lg: 18,
      xl: 20,
      "2xl": 24,
      "3xl": 30,
      "4xl": 36,
      "5xl": 48,
      "6xl": 60,
      display: 36
    },
    weight: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800"
    },
    lineHeight: {
      tight: 1.15,
      heading: 1.2,
      body: 1.6
    },
    maxScale: {
      compact: 1.4,
      body: 2
    }
  },
  letterSpacing: {
    tight: -0.03,
    snug: -0.02,
    normal: 0,
    caps: 0.08
  },
  shadow: {
    xs: {
      shadowColor: "#0d281e",
      shadowOpacity: 0.04,
      shadowRadius: 1,
      shadowOffset: {
        width: 0,
        height: 1
      },
      elevation: 1
    },
    sm: {
      shadowColor: "#0d281e",
      shadowOpacity: 0.06,
      shadowRadius: 4,
      shadowOffset: {
        width: 0,
        height: 2
      },
      elevation: 2
    },
    md: {
      shadowColor: "#0d281e",
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: {
        width: 0,
        height: 8
      },
      elevation: 4
    },
    lg: {
      shadowColor: "#0d281e",
      shadowOpacity: 0.1,
      shadowRadius: 24,
      shadowOffset: {
        width: 0,
        height: 16
      },
      elevation: 8
    },
    xl: {
      shadowColor: "#0d281e",
      shadowOpacity: 0.16,
      shadowRadius: 32,
      shadowOffset: {
        width: 0,
        height: 24
      },
      elevation: 12
    }
  },
  motion: {
    duration: {
      instant: 0,
      fast: 120,
      base: 200,
      slow: 320,
      deliberate: 480,
      route: 900
    },
    easing: {
      standard: [
        0.2,
        0,
        0,
        1
      ],
      emphasized: [
        0.3,
        0,
        0,
        1
      ],
      enter: [
        0.05,
        0.7,
        0.1,
        1
      ],
      exit: [
        0.3,
        0,
        0.8,
        0.15
      ]
    },
    distance: {
      sm: 4,
      md: 8,
      lg: 16
    },
    stagger: {
      step: 40,
      max: 240
    },
    spring: {
      sheet: {
        stiffness: 260,
        damping: 28,
        mass: 1
      },
      press: {
        stiffness: 400,
        damping: 30,
        mass: 1
      }
    }
  },
  touch: {
    min: 44
  },
  control: {
    heightSm: 36,
    height: 44,
    heightLg: 52
  },
  focusRing: {
    width: 2,
    offset: 2
  }
} as const;

export type Tokens = typeof tokens;
