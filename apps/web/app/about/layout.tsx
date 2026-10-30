import { routeMetadata } from "../lib/site-metadata";
export const metadata = routeMetadata("/about/");
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
