"use client";
// UpgradeSheet (design §5.5 J4, §7.2 madde 8): sunucu "kredi yetersiz" dediğinde açılır.
// İçerik: CreditCostTable, sunucudan gelen bakiye, "Planları karşılaştır" (→ /pricing/) ve
// "Kredi paketi al" (→ /checkout/?tab=credits). Fiyat/plan listesi burada YOK: fiyat yalnızca
// canlı katalogdan /pricing/ ve /checkout/'ta gösterilir (S2). Kredi istemcide hesaplanmaz.
// Root layout `UpgradeModal`'ı bağlar; çağıranlar `openUpgradeModal(reason, tab, placement)`
// imzasını değiştirmeden kullanır.
import { useEffect, useState } from "react";
import { billingService } from "../lib/billing/billing-service";
import type { WalletData } from "../lib/billing/billing-types";
import { getStoredSession } from "../lib/cognito";
import { useLocale } from "../lib/locale-context";
import { Button, CreditCostTable, Icon, Modal, Skeleton, VisuallyHidden } from "./ui";
import "./upgrade-modal.css";

type UpgradeTab = "subscriptions" | "packs";
type WalletState =
  { status: "loading" } | { status: "ok"; wallet: WalletData } | { status: "none" };

/** Sheet görünümü (saf sunum): bakiye durumu ve açılış sekmesi dışarıdan gelir. */
export function UpgradeSheet({
  open,
  onClose,
  reason,
  tab,
  wallet,
}: {
  open: boolean;
  onClose: () => void;
  reason?: string;
  tab?: UpgradeTab;
  wallet: WalletState;
}) {
  const { t, locale } = useLocale();
  const packsFirst = tab === "packs";
  const compare = (
    <Button
      key="compare"
      href="/pricing/"
      variant={packsFirst ? "secondary" : "primary"}
      prefetch={false}
      onClick={onClose}
    >
      {t("upgrade.compare")}
    </Button>
  );
  const packs = (
    <Button
      key="packs"
      href="/checkout/?tab=credits"
      variant={packsFirst ? "primary" : "secondary"}
      prefetch={false}
      onClick={onClose}
    >
      {t("upgrade.packs")}
    </Button>
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sheet"
      className="bl-upgrade"
      title={t("upgrade.title")}
      description={reason || t("upgrade.description")}
      footer={
        <div className="bl-upgrade__actions">
          {packsFirst ? [packs, compare] : [compare, packs]}
        </div>
      }
    >
      <div className="bl-upgrade__body">
        {wallet.status !== "none" && (
          <div className="bl-upgrade__balance" data-surface="default">
            <Icon name="coin" size={24} className="bl-upgrade__balance-icon" />
            <div className="bl-upgrade__balance-text">
              <p className="bl-upgrade__balance-label">{t("upgrade.balance")}</p>
              {wallet.status === "loading" ? (
                <p className="bl-upgrade__balance-value">
                  <Skeleton width="72px" height="12px" />
                  <VisuallyHidden>{t("ui.loading", "Yükleniyor…")}</VisuallyHidden>
                </p>
              ) : (
                <p className="bl-upgrade__balance-value" role="status">
                  {t(wallet.wallet.credits === 1 ? "credits.one" : "credits.other").replace(
                    "{n}",
                    wallet.wallet.credits.toLocaleString(locale === "en" ? "en-GB" : "tr-TR"),
                  )}
                  <span className="bl-upgrade__tier">
                    {" · "}
                    {t("upgrade.tier").replace(
                      "{name}",
                      t(`pricing.tier.${wallet.wallet.subscriptionTier}`),
                    )}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}
        <CreditCostTable caption={t("upgrade.costs")} />
        <p className="bl-upgrade__note">{t("upgrade.note")}</p>
      </div>
    </Modal>
  );
}

/** Root layout'ta bir kez bağlanır; `mapsbridge:open_upgrade_modal` olayıyla açılır. */
export function UpgradeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [tab, setTab] = useState<UpgradeTab | undefined>(undefined);
  const [wallet, setWallet] = useState<WalletState>({ status: "none" });

  useEffect(() => {
    const handleOpen = (
      e: CustomEvent<{
        reason?: string;
        tab?: UpgradeTab;
        placement?: string;
      }>,
    ) => {
      setReason(e.detail?.reason || "");
      setTab(e.detail?.tab);
      setIsOpen(true);
      // Bakiye yalnızca sunucudan (oturum varsa); istemci kredi hesaplamaz.
      if (!getStoredSession()) {
        setWallet({ status: "none" });
        return;
      }
      setWallet({ status: "loading" });
      void billingService
        .refreshWallet()
        .then((w) =>
          setWallet(getStoredSession() ? { status: "ok", wallet: w } : { status: "none" }),
        )
        .catch(() => setWallet({ status: "none" }));
    };

    const handleWallet = (e: CustomEvent<unknown>) => {
      if (e.detail && getStoredSession())
        setWallet({ status: "ok", wallet: e.detail as WalletData });
    };

    window.addEventListener("mapsbridge:open_upgrade_modal", handleOpen as EventListener);
    window.addEventListener("mapsbridge:wallet_updated", handleWallet as EventListener);

    return () => {
      window.removeEventListener("mapsbridge:open_upgrade_modal", handleOpen as EventListener);
      window.removeEventListener("mapsbridge:wallet_updated", handleWallet as EventListener);
    };
  }, []);

  return (
    <UpgradeSheet
      open={isOpen}
      onClose={() => setIsOpen(false)}
      reason={reason}
      tab={tab}
      wallet={wallet}
    />
  );
}

/**
 * Paywall / yükseltme sheet'ini açar.
 * @param reason  Kullanıcıya gösterilecek bağlam metni (ör. "Günlük AI kotanız doldu").
 * @param tab     "packs" ise "Kredi paketi al" birincil eylem olur.
 * @param placement  Dönüşüm ölçümü için yerleşim adı (P1–P5):
 *   route_limit | ai_credits_depleted | ai_daily_quota | premium_feature | onboarding
 */
export function openUpgradeModal(
  reason?: string,
  tab?: "subscriptions" | "packs",
  placement?: string,
) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("mapsbridge:open_upgrade_modal", {
        detail: { reason, tab, placement },
      }),
    );
    // Dönüşüm ölçümü: her paywall gösterimi kendi placement adıyla raporlanır.
    window.dispatchEvent(
      new CustomEvent("mapsbridge:paywall_shown", {
        detail: { placement: placement || "generic", reason },
      }),
    );
  }
}
