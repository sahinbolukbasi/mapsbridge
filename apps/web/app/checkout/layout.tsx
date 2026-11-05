import { routeMetadata } from "../lib/site-metadata";
export const metadata = routeMetadata("/checkout/");
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
