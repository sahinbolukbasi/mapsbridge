"use client";
// Yıkıcı/onaylı aksiyonlar için tek ConfirmDialog (design §8.6, FR-7.5, AC-27). Varsayılan odak
// İptal'dedir; gerekçe zorunluysa gerekçe boşken onay butonu devre dışıdır. Hata dialog içinde
// gösterilir (AdminActionError mesajı), dialog açık kalır.
import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "../../components/ui";
import { REASON_MAX, REASON_MIN } from "./edit-dialog";
import { useRefreshHold } from "./use-area-data";

export type ConfirmSpec = {
  title: string;
  consequence: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  /** Varsayılan true: "Gerekçe" zorunlu. string → özel etiket. */
  reason?: boolean | string;
  /** Yazılı onay (ör. "BAKIM"). */
  typed?: string;
  run: (reason: string) => Promise<void>;
};

export function useConfirm(): [ReactNode, (spec: ConfirmSpec) => void] {
  const [spec, setSpec] = useState<ConfirmSpec | null>(null);
  useRefreshHold(spec !== null);
  const reason = spec?.reason ?? true;
  const node = (
    <ConfirmDialog
      open={spec !== null}
      title={spec?.title ?? ""}
      consequence={spec?.consequence ?? null}
      confirmLabel={spec?.confirmLabel ?? "Onayla"}
      tone={spec?.tone ?? "danger"}
      requireReason={
        reason
          ? {
              label: typeof reason === "string" ? reason : "Gerekçe",
              minLength: REASON_MIN,
              maxLength: REASON_MAX,
            }
          : undefined
      }
      requireTypedConfirmation={spec?.typed}
      onConfirm={async (r) => {
        if (spec) await spec.run(r);
      }}
      onClose={() => setSpec(null)}
    />
  );
  return [node, setSpec];
}
