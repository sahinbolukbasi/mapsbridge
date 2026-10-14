import { AIAsistanClient } from "./ai-asistan-client";
import { publicMetadata } from "../lib/site-metadata";

export const metadata = publicMetadata(
  "AI Asistan & Harita Masası Tanıtım Platformu",
  "Hayalindeki rotayı MapsBridge AI asistanına anlat, masaüstü harita masasında durak havuzu ve zemin analiziyle sanat gibi yönet.",
  "/ai-asistan/",
  "tr",
);

export default function AIAsistanTanitimPage() {
  return <AIAsistanClient />;
}
