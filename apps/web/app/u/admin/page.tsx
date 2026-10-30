import type { Metadata } from "next";
import { routeMetadata } from "../../lib/site-metadata";
import AdminClient from "./admin-client";

// Server bileşeni: yalnızca metadata (noindex, registry'den) + istemci kökü (G4 *-client.tsx).
export const metadata: Metadata = { ...routeMetadata("/u/admin/"), title: "Yönetim" };

export default function Page() {
  return <AdminClient />;
}
