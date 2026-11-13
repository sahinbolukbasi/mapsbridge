"use client";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Alert, Badge, Button, Icon, Modal } from "../ui";
import { useLocale } from "../../lib/locale-context";
import {
  buildPinShareUrl,
  encodePinCode,
  generateNumericPinCode,
  type PinPoint,
} from "../../lib/share/pin-link";
import { buildDirections } from "../../lib/share/map-directions";
import "./travel-planner.css";

/**
 * Haritalar ekranı durak paylaşımı (D3): yalnızca seçilen konumun 6 haneli paylaşım kodu ve
 * doğrudan paylaşılan sayfayı açan QR kodu oluşturulur (kod girişi ve QR okutma Profil ekranındadır).
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

  const { numericCode, url } = useMemo(() => {
    if (!target) return { code: "", numericCode: "", url: "" };
    const c = encodePinCode(target);
    const num = generateNumericPinCode(target);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://mapsbridge.com";
    return {
      code: c,
      numericCode: num,
      url: buildPinShareUrl(target, origin),
    };
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
        {target && (
          <div className="planner-share__banner">
            <Badge tone="brand">
              <Icon name="map" size={16} />
              {target.label || t("planner.pinShare.title", "Seçilen Konum")}
            </Badge>
            <p className="planner-share__coords">
              {target.lat.toFixed(5)}, {target.lng.toFixed(5)}
            </p>
          </div>
        )}
        <p className="planner-share__hint">
          {t(
            "planner.pinShare.hint",
            "Kodu söyle ya da QR'ı okut: karşı taraf kendi harita uygulamasında bulunduğu konumdan bu durağa yol tarifi açar. Hesap gerekmez.",
          )}
        </p>
        <div className="planner-share__code">
          <span className="planner-share__code-label">
            {t("planner.pinShare.code", "6 Haneli Paylaşım Kodu")}
          </span>
          <span className="planner-share__code-value">
            {numericCode.slice(0, 3)} {numericCode.slice(3)}
          </span>
          <Button
            size="sm"
            variant="secondary"
            iconStart={<Icon name={copied === "code" ? "check" : "copy"} size={16} />}
            onClick={() => copy("code", numericCode)}
          >
            {copied === "code"
              ? t("planner.share.copied", "Kopyalandı")
              : t("planner.pinShare.copyCode", "Kodu kopyala")}
          </Button>
        </div>
        <div className="planner-share__qr" data-surface="default">
          <QRCodeSVG
            value={url}
            size={156}
            level="M"
            title={t("planner.pinShare.qr", "Durak bağlantısının QR kodu")}
          />
        </div>
        <p className="planner-share__url">{url}</p>
        {target && (
          <div className="planner-share__actions">
            <Button
              size="sm"
              variant="secondary"
              href={buildDirections({ dest: target, provider: "google" })}
              target="_blank"
              rel="noreferrer"
            >
              Google Haritalar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              href={buildDirections({ dest: target, provider: "yandex" })}
              target="_blank"
              rel="noreferrer"
            >
              Yandex Haritalar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              href={buildDirections({ dest: target, provider: "apple" })}
              target="_blank"
              rel="noreferrer"
            >
              Apple Haritalar
            </Button>
          </div>
        )}
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
            variant="secondary"
            iconEnd={<Icon name="external" size={20} />}
          >
            {t("planner.pinShare.open", "Paylaşılan sayfayı aç")}
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
