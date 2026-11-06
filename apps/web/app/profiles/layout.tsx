import { routeMetadata } from "../lib/site-metadata";
export const metadata = routeMetadata("/profiles/");
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
