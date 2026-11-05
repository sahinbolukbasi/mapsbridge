import { LegacyRedirect, legacyMetadata } from "../components/ui/legacy-redirect";
export const metadata = legacyMetadata("/dogrula/");
export default function Page() {
  return <LegacyRedirect from="/dogrula/" />;
}
