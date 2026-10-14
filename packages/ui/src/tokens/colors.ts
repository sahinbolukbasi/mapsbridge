/**
 * MapsBridge Design System - Color Palette
 * Curated HSL and Hex tokens for web and future mobile applications.
 */

export const colors = {
  // Brand Primary (Emerald / Forest green)
  primary: {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
    800: "#065f46",
    900: "#064e3b",
    950: "#022c22",
  },

  // Secondary / Accent (Deep Teal / Pine)
  secondary: {
    50: "#f0fdfa",
    100: "#ccfbf1",
    200: "#99f6e4",
    300: "#5eead4",
    400: "#2dd4bf",
    500: "#14b8a6",
    600: "#0d9488",
    700: "#0f766e",
    800: "#115e59",
    900: "#134e4a",
    950: "#042f2e",
  },

  // Slate / Neutral Base
  neutral: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
  },

  // Semantic Status Colors
  success: {
    light: "#d1fae5",
    main: "#10b981",
    dark: "#047857",
    contrastText: "#ffffff",
  },
  warning: {
    light: "#fef3c7",
    main: "#f59e0b",
    dark: "#b45309",
    contrastText: "#1e293b",
  },
  error: {
    light: "#fee2e2",
    main: "#ef4444",
    dark: "#b91c1c",
    contrastText: "#ffffff",
  },
  info: {
    light: "#e0f2fe",
    main: "#0284c7",
    dark: "#0369a1",
    contrastText: "#ffffff",
  },

  // Dark Mode Canvas & Surfaces
  darkSurface: {
    background: "#090d16",
    card: "rgba(15, 23, 42, 0.75)",
    border: "rgba(255, 255, 255, 0.08)",
    highlight: "rgba(16, 185, 129, 0.12)",
  },
} as const;

export type ColorPalette = typeof colors;
