import { LegacyRedirect, legacyMetadata } from "../components/ui/legacy-redirect";
export const metadata = legacyMetadata("/harita/");
export default function Page() {
  return <LegacyRedirect from="/harita/" />;
}
