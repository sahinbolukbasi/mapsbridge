import { routeMetadata } from "../lib/site-metadata";
export const metadata = routeMetadata("/cookies/");
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
