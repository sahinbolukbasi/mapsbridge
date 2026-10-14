import { publicMetadata } from "../lib/site-metadata";
import { HowItWorksClient } from "./how-it-works-client";

export const metadata = publicMetadata(
  "Nasıl Çalışır? · MapsBridge Akıllı Seyahat Kılavuzu",
  "MapsBridge ile seyahat planlama, yapay zeka optimizasyonu, canlı harita masası ve 6 haneli kodla paylaşım nasıl çalışır? Adım adım keşfedin.",
  "/how-it-works/",
  "tr",
);

export default function HowItWorksPage() {
  return <HowItWorksClient />;
}
