import { LegacyRedirect, legacyMetadata } from "../components/ui/legacy-redirect";
export const metadata = legacyMetadata("/haritalar/");
export default function Page() {
  return <LegacyRedirect from="/haritalar/" />;
}
