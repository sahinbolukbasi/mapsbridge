import type { Metadata } from "next";
import { NotFoundView } from "./components/not-found-view";

export const metadata: Metadata = {
  title: "404 - Rota Dışına Çıkıldı | MapsBridge",
  description:
    "Aradığınız durak haritada bulunamadı. Görünüşe göre rotanızdan saptınız veya sayfa taşınmış olabilir.",
};

export default function NotFound() {
  return <NotFoundView />;
}
