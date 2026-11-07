import React, { useEffect, useRef } from "react";
import { tripStore } from "../services/tripStore";
import { wasExplained } from "../services/permissions";
import { usePermission } from "./PermissionPrompt";
// Bildirim izni bağlamı (N1): ilk rota KAYDINDA sorulur — oturumlu kullanıcının duraklı rota
// sayısı bu oturumda arttığında, gerekçe daha önce gösterilmediyse. Misafirde sorulmaz.
const savedCount = () => tripStore.getAllRoutes().filter((r) => r.stops.length > 0).length;
export function FirstRouteReminder({
  enabled,
  onGranted,
}: {
  enabled: boolean;
  onGranted?: () => void;
}) {
  const { ensure, element } = usePermission("notifications");
  const baseline = useRef<number | null>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    baseline.current = savedCount();
    return tripStore.subscribe(() => {
      const n = savedCount();
      if (asked.current || baseline.current === null || n <= baseline.current) {
        if (baseline.current !== null && n < baseline.current) baseline.current = n;
        return;
      }
      asked.current = true;
      void (async () => {
        if (await wasExplained("notifications")) return;
        if (await ensure()) onGranted?.();
      })();
    });
  }, [enabled, ensure, onGranted]);
  return <>{element}</>;
}
