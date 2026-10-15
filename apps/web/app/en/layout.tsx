import { publicMetadata } from "../lib/site-metadata";
export const metadata = publicMetadata(
  "Plan your journey, discover together",
  "Plan a trip with your AI travel assistant, save places on your map and discover guides from fellow travelers.",
  "/en/",
  "en",
);
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
