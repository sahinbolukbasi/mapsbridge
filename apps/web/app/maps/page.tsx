"use client";
import { useEffect, useState } from "react";
import { LoadingState, PageHeader, PageShell } from "../components/ui";
import Panel from "./maps-client";

/**
 * Planlayıcı hidrasyondan sonra bağlanır: useTravelPlanner gezileri ilk render'da cihaz
 * deposundan okur; statik HTML (boş planlayıcı) ile kayıtlı gezi farklı çizildiğinde React
 * #418 hidrasyon hatası oluşuyordu. Statik çıktı yükleme kabuğudur (mesajlar sayfasıyla aynı).
 */
export default function MapsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (mounted) return <Panel />;
  return (
    <PageShell className="planner">
      <PageHeader variant="hidden" />
      <LoadingState />
    </PageShell>
  );
}
