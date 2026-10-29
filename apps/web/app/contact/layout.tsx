import { publicMetadata } from "../lib/site-metadata";

export const metadata = publicMetadata(
  "İletişim",
  "MapsBridge ile iletişime geçin. Soru, öneri ve destek talepleriniz için bize ulaşın.",
  "/contact/",
  "tr",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
