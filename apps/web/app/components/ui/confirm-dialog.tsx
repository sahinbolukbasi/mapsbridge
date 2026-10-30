"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLocale } from "../../lib/locale-context";
import { Alert } from "./alert";
import { Button } from "./button";
import { Field } from "./field";
import { Input } from "./input";
import { Modal } from "./modal";
import { Textarea } from "./textarea";
import { useToast } from "./toast";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  consequence: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  requireReason?: { label: string; minLength?: number; maxLength?: number };
  requireTypedConfirmation?: string;
  successMessage?: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
};

/** Yıkıcı aksiyon onayı. Varsayılan odak İptal'dir (yanlışlıkla Enter'ı önler). */
export function ConfirmDialog({
  open,
  title,
  consequence,
  confirmLabel,
  tone = "danger",
  requireReason,
  requireTypedConfirmation,
  successMessage,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useLocale();
  const toast = useToast();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const formId = useId();
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason("");
      setTyped("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const min = requireReason?.minLength ?? 3;
  const max = requireReason?.maxLength ?? 1000;
  const reasonOk = !requireReason || (reason.trim().length >= min && reason.length <= max);
  const typedOk = !requireTypedConfirmation || typed.trim() === requireTypedConfirmation;
  const ready = reasonOk && typedOk && !busy;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      if (successMessage) toast.show({ tone: "success", message: successMessage });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ui.unexpectedError", "Beklenmeyen hata"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      size="sm"
      dismissible={!busy}
      initialFocus={cancelRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy} ref={cancelRef}>
            {t("ui.cancel", "İptal")}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            type="submit"
            form={formId}
            loading={busy}
            disabled={!ready}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="ui-confirm"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="ui-confirm__consequence">{consequence}</div>
        {requireReason && (
          <Field label={requireReason.label} required>
            {(ids) => (
              <Textarea
                {...ids}
                value={reason}
                minLength={min}
                maxLength={max}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </Field>
        )}
        {requireTypedConfirmation && (
          <Field
            label={t("ui.typeToConfirm", "Onaylamak için yazın: {value}").replace(
              "{value}",
              requireTypedConfirmation,
            )}
            required
          >
            {(ids) => (
              <Input
                {...ids}
                value={typed}
                autoComplete="off"
                onChange={(e) => setTyped(e.target.value)}
              />
            )}
          </Field>
        )}
        {error && (
          <Alert tone="danger" live="assertive">
            {error}
          </Alert>
        )}
      </form>
    </Modal>
  );
}
