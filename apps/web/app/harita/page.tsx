import { redirect } from "next/navigation";
import { publicMetadata } from "../lib/site-metadata";

export const metadata = publicMetadata(
  "Harita Masası Özellikleri & Kullanım Kılavuzu",
  "Büyük ekranda mimari hassasiyetle çoklu gün katmanları, akıllı durak havuzu ve topografik irtifa analizleriyle seyahatinizi planlayın.",
  "/harita/",
  "tr",
);

export default function HaritaTanitimPage() {
  // Keep the legacy URL as a stable entry point to the actual map workspace.
  // The public feature page remains available through the product content links.
  redirect("/maps/");
}
