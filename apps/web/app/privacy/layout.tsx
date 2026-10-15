import { publicMetadata } from "../lib/site-metadata";
export const metadata = publicMetadata(
  "Gizlilik politikası",
  "MapsBridge gizlilik politikası ve kişisel verilerin kullanımı.",
  "/privacy/",
  "tr",
);
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
