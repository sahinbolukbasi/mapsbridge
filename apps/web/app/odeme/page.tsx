import { LegacyRedirect, legacyMetadata } from "../components/ui/legacy-redirect";
export const metadata = legacyMetadata("/odeme/");
export default function Page() {
  return <LegacyRedirect from="/odeme/" />;
}
