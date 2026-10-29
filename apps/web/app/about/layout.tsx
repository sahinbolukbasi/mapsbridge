import { publicMetadata } from "../lib/site-metadata";

export const metadata = publicMetadata(
  "Hakkımızda",
  "MapsBridge: yapay zeka destekli seyahat planlama ve güvenli konum paylaşımı platformu. Misyonumuz, seyahatin kendisini kolaylaştırmak.",
  "/about/",
  "tr",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
