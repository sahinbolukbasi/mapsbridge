import { LegacyRedirect, legacyMetadata } from "../components/ui/legacy-redirect";
export const metadata = legacyMetadata("/welcome/");
export default function Page() {
  return <LegacyRedirect from="/welcome/" />;
}
