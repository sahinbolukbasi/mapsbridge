"use client";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Alert, Button, Icon, Modal } from "../ui";
import { useLocale } from "../../lib/locale-context";
import { encodePinCode, type PinPoint } from "../../lib/share/pin-link";
import "./travel-planner.css";

/**
 * Durak paylaşımı (D3): bir pin'in koordinatı + etiketi SUNUCUSUZ kısa koda gömülür ve /p/?c=<kod>
 * bağlantısı + QR olarak gösterilir. Hesap gerekmez (misafir de kullanır); ağ turu yok (I12).
 * /k/ süreli konum paylaşımından ayrıdır: bu, taksiciye gösterilecek açık varış noktasıdır.
 */
export function PinShareModal({
  open,
  target,
  onClose,
}: {
  open: boolean;
  target: PinPoint | null;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    if (!open) {
      setCopied(null);
      setCopyStatus("");
      setCopyError("");
    }
  }, [open]);

  const { code, url } = useMemo(() => {
    if (!target) return { code: "", url: "" };
    const c = encodePinCode(target);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://mapsbridge.com";
    return { code: c, url: `${origin}/p/?c=${c}` };
  }, [target]);

  function copy(kind: "code" | "link", text: string) {
    setCopyError("");
    setCopyStatus("");
    const write = navigator.clipboard?.writeText
      ? navigator.clipboard.writeText(text)
      : Promise.reject(new Error("clipboard unavailable"));
    write
      .then(() => {
        setCopied(kind);
        window.setTimeout(() => setCopied(null), 2500);
        setCopyStatus(
          kind === "code"
            ? t("planner.pinShare.copiedCode", "Durak kodu kopyalandı.")
            : t("planner.pinShare.copiedLink", "Bağlantı kopyalandı."),
        );
      })
      .catch(() =>
        setCopyError(
          t("planner.pinShare.copyFailed", "Kopyalanamadı. Kodu seçip elle kopyalayabilirsin."),
        ),
      );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sheet"
      className="planner-share"
      title={t("planner.pinShare.title", "Bu durağı paylaş")}
      description={target?.label}
    >
      <div className="planner-share__body">
        <p className="planner-share__hint">
          {t(
            "planner.pinShare.hint",
            "Kodu söyle ya da QR'ı okut: karşı taraf kendi harita uygulamasında bulunduğu konumdan bu durağa yol tarifi açar. Hesap gerekmez.",
          )}
        </p>
        <div className="planner-share__code">
          <span className="planner-share__code-label">
            {t("planner.pinShare.code", "Durak kodu")}
          </span>
          <span className="planner-share__code-value">{code}</span>
          <Button
            size="sm"
            variant="secondary"
            iconStart={<Icon name={copied === "code" ? "check" : "copy"} size={16} />}
            onClick={() => copy("code", code)}
          >
            {copied === "code"
              ? t("planner.share.copied", "Kopyalandı")
              : t("planner.pinShare.copyCode", "Kodu kopyala")}
          </Button>
        </div>
        <div className="planner-share__qr" data-surface="default">
          <QRCodeSVG
            value={url}
            size={128}
            level="M"
            title={t("planner.pinShare.qr", "Durak bağlantısının QR kodu")}
          />
        </div>
        <p className="planner-share__url">{url}</p>
        <div className="planner-share__actions">
          <Button
            variant="primary"
            iconStart={<Icon name={copied === "link" ? "check" : "copy"} size={20} />}
            onClick={() => copy("link", url)}
          >
            {copied === "link"
              ? t("planner.share.copied", "Kopyalandı")
              : t("planner.pinShare.copyLink", "Bağlantıyı kopyala")}
          </Button>
          <Button
            href={url}
            target="_blank"
            rel="noreferrer"
            variant="ghost"
            iconEnd={<Icon name="external" size={20} />}
          >
            {t("planner.pinShare.open", "Yol tarifi sayfasını aç")}
          </Button>
        </div>
        {copyError && (
          <Alert tone="danger" live="assertive">
            {copyError}
          </Alert>
        )}
        <p className="ui-visually-hidden" role="status" data-pin-share-copy-status>
          {copyStatus}
        </p>
      </div>
    </Modal>
  );
}
