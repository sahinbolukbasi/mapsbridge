import { LegacyRedirect, legacyMetadata } from "../components/ui/legacy-redirect";
export const metadata = legacyMetadata("/gezi-asistani/");
export default function Page() {
  return <LegacyRedirect from="/gezi-asistani/" />;
}
