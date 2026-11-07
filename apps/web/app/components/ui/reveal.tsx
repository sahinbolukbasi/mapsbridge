"use client";
// Kaydırmaya bağlı açılma kabı (direction §2, R15). `stagger` iken kap görünür kalır ve
// içindeki [data-reveal-item] öğeleri --i sırasıyla yükselir; aksi hâlde kabın tamamı açılır.
// JS yoksa ya da hareket azaltılmışsa içerik baştan görünür (gizleme yalnız ui.css no-preference).
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { useReveal } from "./hooks/use-reveal";
import "./ui.css";

export function Reveal({
  as: Tag = "div",
  stagger = false,
  className,
  children,
  ...rest
}: {
  as?: "div" | "section" | "ul" | "ol";
  stagger?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">) {
  const ref = useReveal<HTMLDivElement>();
  return (
    // Etiket türü değişse de ref yalnız HTMLElement olarak kullanılır.
    <Tag
      {...rest}
      ref={ref as never}
      className={cx("ui-reveal", stagger && "ui-reveal--stagger", className)}
    >
      {children}
    </Tag>
  );
}

/** Kademeli öğe için öznitelikler: `<li {...revealItem(i)}>`. */
export function revealItem(i: number): { "data-reveal-item": ""; style: CSSProperties } {
  return { "data-reveal-item": "", style: { "--i": i } as CSSProperties };
}

/** Giriş koreografisi öznitelikleri: `<p {...enterItem(2)}>` (yükselme), `enterItem(1, "scale")`. */
export function enterItem(
  i: number,
  kind: "rise" | "fade" | "scale" = "rise",
): { "data-enter": string; style: CSSProperties } {
  return {
    "data-enter": kind === "rise" ? "" : kind,
    style: { "--i": i } as CSSProperties,
  };
}
