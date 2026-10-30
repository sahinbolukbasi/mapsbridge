import { LegacyRedirect, legacyMetadata } from "../components/ui/legacy-redirect";
export const metadata = legacyMetadata("/u/");
export default function Page() {
  return <LegacyRedirect from="/u/" />;
}
