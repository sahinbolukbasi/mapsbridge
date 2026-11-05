import { LegacyRedirect, legacyMetadata } from "../components/ui/legacy-redirect";
export const metadata = legacyMetadata("/planlar/");
export default function Page() {
  return <LegacyRedirect from="/planlar/" />;
}
