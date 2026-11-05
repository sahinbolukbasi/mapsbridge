"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { routesApi } from "../lib/api-client";
import { getStoredSession } from "../lib/cognito";
import { useLocale } from "../lib/locale-context";
import { COPY_MAX_STOPS, copyRouteName, type CopyStop } from "../lib/trip/copy-stops";
import { AuthGate } from "./auth-gate";
import { Button, Icon, useToast, type ButtonSize, type ButtonVariant } from "./ui";

/**
 * "Bu rotayı kopyala" (design §5.5 J2, §6.4): misafire AuthGate sheet (reason="save") açar;
 * oturumlu kullanıcıda durakları hesabına yeni rota olarak yazar (`POST /routes`, planlayıcının
 * eşitlemesiyle aynı uç) ve planlayıcıda açar. Kopyalanacak durak yoksa render edilmez (I10).
 * Kredi düşülmez; istemci kredi hesaplamaz.
 */
export function CopyRouteButton({
  title,
  stops,
  next,
  label,
  variant = "secondary",
  size = "md",
  fullWidth,
}: {
  title: string;
  stops: CopyStop[];
  /** Kapıdan sonra dönülecek sayfa (safe-next ile doğrulanır). */
  next: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [gateOpen, setGateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (stops.length === 0) return null;

  async function copy() {
    if (!getStoredSession()?.token) {
      setGateOpen(true);
      return;
    }
    setBusy(true);
    try {
      const res = await routesApi.create({
        name: copyRouteName(title) ?? t("copyRoute.defaultName", "Kopyalanan rota"),
        stops: stops.slice(0, COPY_MAX_STOPS),
        isPublic: false,
      });
      if (!res?.routeId) throw new Error("routeId yok");
      router.push(`/maps/?trip=${encodeURIComponent(res.routeId)}`);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.warn("[copy-route]", err);
      toast.show({
        tone: "danger",
        message: t("copyRoute.failed", "Rota kopyalanamadı. Biraz sonra tekrar dene."),
      });
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        loading={busy}
        onClick={() => void copy()}
        iconStart={<Icon name="copy" size={16} />}
      >
        {label ?? t("copyRoute.label", "Bu rotayı kopyala")}
      </Button>
      <AuthGate
        variant="sheet"
        reason="save"
        next={next}
        open={gateOpen}
        onClose={() => setGateOpen(false)}
      />
    </>
  );
}
