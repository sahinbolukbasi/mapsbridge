"use client";
// motion@14.9.1 tek sarmalayıcısı (approval.json animationLibrary; ESLint no-restricted-imports).
// Yalnız sürükle-bırak yeniden sıralama (Reorder) ve paylaşılan öğe geçişleri (LayoutGroup,
// layoutId) için; geri kalan her hareket CSS + token'dır (design-system.md R9/R14).
// Hareket azaltma: MotionProvider reducedMotion="user" ile transform/layout animasyonlarını
// kapatır; useMotionTransition() azaltmada { duration: 0 } döner (lib/a11y/use-reduced-motion).
import { createElement, type ReactNode } from "react";
import { MotionConfig, type Transition } from "motion/react";
import { useReducedMotion } from "../a11y/use-reduced-motion";

export { AnimatePresence, LayoutGroup, Reorder, motion, useDragControls } from "motion/react";
export type { Transition } from "motion/react";

/** Token süresi (--duration-base 200 ms) ve --easing-standard eşleniği; JS tarafı için. */
export const MOTION_BASE: Transition = { duration: 0.2, ease: [0.2, 0, 0, 1] };

/** Azaltılmış harekette süre 0 (anında son durum). */
export function useMotionTransition(transition: Transition = MOTION_BASE): Transition {
  return useReducedMotion() ? { duration: 0 } : transition;
}

/** motion kullanan ağacı sarar: kullanıcı tercihi azaltılmışsa transform/layout animasyonu yok. */
export function MotionProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return createElement(
    MotionConfig,
    { reducedMotion: "user", transition: reduced ? { duration: 0 } : MOTION_BASE },
    children,
  );
}
