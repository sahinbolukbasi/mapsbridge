import { LegacyRedirect, legacyMetadata } from "../components/ui/legacy-redirect";
export const metadata = legacyMetadata("/forgot-password/");
export default function Page() {
  return <LegacyRedirect from="/forgot-password/" />;
}
