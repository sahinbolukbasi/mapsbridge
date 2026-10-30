import { LegacyRedirect, legacyMetadata } from "../components/ui/legacy-redirect";
export const metadata = legacyMetadata("/ai/");
export default function Page() {
  return <LegacyRedirect from="/ai/" />;
}
