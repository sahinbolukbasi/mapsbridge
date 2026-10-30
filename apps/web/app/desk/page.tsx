import { LegacyRedirect, legacyMetadata } from "../components/ui/legacy-redirect";
export const metadata = legacyMetadata("/desk/");
export default function Page() {
  return <LegacyRedirect from="/desk/" />;
}
