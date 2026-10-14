/**
 * MapsBridge Design System - Shadows & Glassmorphism Tokens
 */

export const shadows = {
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  glowPrimary: "0 0 25px rgba(16, 185, 129, 0.35)",
  glowAccent: "0 0 25px rgba(20, 184, 166, 0.35)",
} as const;

export const glassmorphism = {
  card: {
    background: "rgba(15, 23, 42, 0.7)",
    backdropFilter: "blur(16px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
  },
  modal: {
    background: "rgba(10, 15, 29, 0.85)",
    backdropFilter: "blur(24px)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
  },
  navPill: {
    background: "rgba(30, 41, 59, 0.6)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
  },
} as const;

export type Shadows = typeof shadows;
export type Glassmorphism = typeof glassmorphism;
