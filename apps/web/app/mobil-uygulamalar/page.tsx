import { LegacyRedirect, legacyMetadata } from "../components/ui/legacy-redirect";
export const metadata = legacyMetadata("/mobil-uygulamalar/");
export default function Page() {
  return <LegacyRedirect from="/mobil-uygulamalar/" />;
}
