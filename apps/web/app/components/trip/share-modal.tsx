"use client";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Alert, Button, Celebrate, Icon, Modal, SegmentedControl, useToast } from "../ui";
import { useLocale } from "../../lib/locale-context";
import { API_ENDPOINT } from "../../lib/api";
import { getStoredSession } from "../../lib/cognito";
import { userStorage } from "../../lib/user-storage";
import {
  DEFAULT_SHARE_HOURS,
  SHARE_DURATIONS,
  shareLink,
  type ShareHours,
} from "../../lib/trip/planner-logic";
import "./travel-planner.css";

export type ShareTarget = { lat: number; lng: number; address: string; label: string };
type Created = { code: string; token: string; url: string; expiresAt: number };

/**
 * Süreli konum paylaşımı (design §5.5 J2). Mevcut POST /shares çağrısı tek bir konum
 * (lat/lng/adres) ve `hours` alır; süre seçici yalnızca sunucunun uyguladığı 1 sa / 24 sa /
 * 7 gün değerlerini sunar (planner-logic SHARE_DURATIONS, I10). Bağlantı /k/?code= biçimindedir.
 * Oturumsuz kullanıcı bu modala ulaşmaz (AuthGate sheet, design §6.3).
 */
export function ShareModal({
  open,
  target,
  onClose,
}: {
  open: boolean;
  target: ShareTarget | null;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const toast = useToast();
  const [hours, setHours] = useState<ShareHours>(DEFAULT_SHARE_HOURS);
  const [created, setCreated] = useState<Created | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    if (!open) {
      setCreated(null);
      setError("");
      setCopied(null);
    }
  }, [open]);

  async function create() {
    const session = getStoredSession();
    if (!target || !session?.token || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_ENDPOINT}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ lat: target.lat, lng: target.lng, address: target.address, hours }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.code || !data.token)
        throw new Error(data.error || t("planner.share.failed", "Paylaşım oluşturulamadı."));
      const url = shareLink(window.location.origin, data.token);
      setCreated({ code: data.code, token: data.token, url, expiresAt: data.expiresAt });
      try {
        const recent = JSON.parse(userStorage.getItem("mapsbridge.shares") || "[]");
        const list = Array.isArray(recent)
          ? recent.filter((item: { expiresAt: number }) => item.expiresAt * 1000 > Date.now())
          : [];
        userStorage.setItem(
          "mapsbridge.shares",
          JSON.stringify([...list, { code: data.code, expiresAt: data.expiresAt, url }]),
        );
      } catch {
        setError(
          t(
            "planner.share.historyFailed",
            "Paylaşım oluşturuldu, ancak bu cihazda geçmişe kaydedilemedi.",
          ),
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("planner.share.network", "Bağlantı kurulamadı. Tekrar dene."),
      );
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }

  async function revoke() {
    const session = getStoredSession();
    if (!created || !session?.token || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_ENDPOINT}/shares/${created.code}/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error();
      try {
        const recent = JSON.parse(userStorage.getItem("mapsbridge.shares") || "[]");
        if (Array.isArray(recent))
          userStorage.setItem(
            "mapsbridge.shares",
            JSON.stringify(recent.filter((item: { code: string }) => item.code !== created.code)),
          );
      } catch {}
      setCreated(null);
    } catch {
      setError(t("planner.share.revokeFailed", "Paylaşım iptal edilemedi. Tekrar dene."));
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }

  function copy(kind: "code" | "link", text: string) {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(kind);
        window.setTimeout(() => setCopied(null), 2500);
        // Increment 2.8: kopyalama onayı (ikon onay + toast).
        toast.show({
          tone: "success",
          message:
            kind === "code"
              ? t("planner.share.copiedCode", "Paylaşım kodu kopyalandı.")
              : t("planner.share.copiedLink", "Paylaşım bağlantısı kopyalandı."),
        });
      })
      .catch(() =>
        // Hata yutulmaz: neden + tek sonraki adım (direction §3).
        toast.show({
          tone: "danger",
          message: t(
            "planner.share.copyFailed",
            "Kopyalanamadı. Kodu seçip elle kopyalayabilirsin.",
          ),
        }),
      );
  }

  const options = SHARE_DURATIONS.map((d) => ({
    value: String(d.hours),
    label: t(d.labelKey, d.fallback),
  })) as [
    { value: string; label: string },
    { value: string; label: string },
    { value: string; label: string },
  ];
  const durationText = options.find((o) => o.value === String(hours))?.label ?? String(hours);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sheet"
      className="planner-share"
      title={t("planner.share.title", "Konumu paylaş")}
      description={target?.label}
    >
      {!created ? (
        <div className="planner-share__body">
          <SegmentedControl
            label={t("planner.share.duration", "Bağlantı ne kadar geçerli olsun?")}
            options={options}
            value={String(hours)}
            onChange={(v) => setHours(Number(v) as ShareHours)}
          />
          <p className="planner-share__hint">
            {t(
              "planner.share.hint",
              "Bağlantıyı alan kişi bu konumu süre dolana kadar hesap açmadan görür. İstediğin zaman iptal edebilirsin.",
            )}
          </p>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button
            variant="primary"
            fullWidth
            loading={busy}
            disabled={!target}
            iconStart={<Icon name="share" size={20} />}
            onClick={() => void create()}
          >
            {t("planner.share.create", "Bağlantı oluştur")}
          </Button>
        </div>
      ) : (
        <div className="planner-share__body">
          <Celebrate
            title={t("planner.share.readyTitle", "Bağlantı hazır")}
            message={t("planner.share.ready", "Bağlantı {duration} geçerli.").replace(
              "{duration}",
              durationText,
            )}
          />
          <div className="planner-share__code">
            <span className="planner-share__code-label">
              {t("planner.share.code", "Paylaşım kodu")}
            </span>
            <span className="planner-share__code-value">{created.code}</span>
            <Button
              size="sm"
              variant="secondary"
              iconStart={<Icon name={copied === "code" ? "check" : "copy"} size={16} />}
              onClick={() => copy("code", created.code)}
            >
              {copied === "code"
                ? t("planner.share.copied", "Kopyalandı")
                : t("planner.share.copyCode", "Kodu kopyala")}
            </Button>
          </div>
          <div className="planner-share__qr" data-surface="default">
            <QRCodeSVG
              value={created.url}
              size={128}
              level="M"
              title={t("planner.share.qr", "Paylaşım bağlantısının QR kodu")}
            />
          </div>
          <p className="planner-share__url">{created.url}</p>
          <div className="planner-share__actions">
            <Button
              variant="primary"
              iconStart={<Icon name={copied === "link" ? "check" : "copy"} size={20} />}
              onClick={() => copy("link", created.url)}
            >
              {copied === "link"
                ? t("planner.share.copied", "Kopyalandı")
                : t("planner.share.copyLink", "Bağlantıyı kopyala")}
            </Button>
            <Button variant="ghost" loading={busy} onClick={() => void revoke()}>
              {t("planner.share.revoke", "Paylaşımı iptal et")}
            </Button>
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}
