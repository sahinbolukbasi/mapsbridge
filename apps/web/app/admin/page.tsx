import { LegacyRedirect, legacyMetadata } from "../components/ui/legacy-redirect";
export const metadata = legacyMetadata("/admin/");
export default function Page() {
  return <LegacyRedirect from="/admin/" />;
}
