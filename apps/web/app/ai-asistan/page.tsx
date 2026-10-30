import { LegacyRedirect, legacyMetadata } from "../components/ui/legacy-redirect";
export const metadata = legacyMetadata("/ai-asistan/");
export default function Page() {
  return <LegacyRedirect from="/ai-asistan/" />;
}
