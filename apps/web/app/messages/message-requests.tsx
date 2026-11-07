"use client";
// "Mesaj istekleri" kutusu (Increment 1.14 M1/M2, görsel 3.8): bana gelen istekler kart olarak —
// gönderen avatarı + profil bağlantısı, istek zamanı, Kabul et / Reddet / Engelle; gönderdiğim
// istekler "Yanıt bekleniyor". Veri GET /chat/threads (request durumu sunucudan); mesaj önizlemesi
// özet uçta yok, uydurulmaz (I1).
import Link from "next/link";
import { Avatar, Badge, Button, EmptyState, Icon, revealItem } from "../components/ui";
import type { ChatThreadSummary } from "../lib/api-client";
import type { RequestAction } from "../features/messaging/requests";
import { useLocale } from "../lib/locale-context";
import { profileHref } from "../lib/navigation/profile-href";
export function MessageRequests({
  incoming,
  outgoing,
  busyId,
  onRespond,
}: {
  incoming: readonly ChatThreadSummary[];
  outgoing: readonly ChatThreadSummary[];
  busyId: string | null;
  onRespond: (threadId: string, action: RequestAction) => void;
}) {
  const { t, locale } = useLocale();
  if (incoming.length === 0 && outgoing.length === 0)
    return (
      <EmptyState
        icon="inbox"
        contour
        level={3}
        title={t("messages.req.empty", "Bekleyen istek yok")}
        description={t(
          "messages.req.emptyBody",
          "Seninle ilk kez yazışmak isteyen gezginlerin istekleri burada görünür.",
        )}
      />
    );
  const who = (x: ChatThreadSummary) =>
    x.otherParticipant || t("messages.req.someone", "Bir gezgin");
  const when = (x: ChatThreadSummary) =>
    x.lastMessageAt
      ? new Date(x.lastMessageAt).toLocaleString(locale === "en" ? "en-GB" : "tr-TR", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
  return (
    <section className="msg-requests" aria-labelledby="msg-requests-title">
      <h3 id="msg-requests-title" className="msg-requests__title">
        <Icon name="inbox" size={16} />
        {t("messages.req.title", "Mesaj istekleri ({n})").replace("{n}", String(incoming.length))}
      </h3>
      {incoming.length > 0 && (
        <ul className="msg-requests__list">
          {incoming.map((x, i) => {
            const href = x.otherParticipant ? profileHref(x.otherParticipant) : null;
            const time = when(x);
            return (
              <li
                key={x.threadId}
                className="msg-requests__item"
                data-surface="default"
                {...revealItem(i)}
              >
                <div className="msg-requests__head">
                  <Avatar name={who(x)} size="sm" decorative />
                  <div className="msg-requests__who-wrap">
                    {href ? (
                      <Link href={href} className="msg-requests__who">
                        {who(x)}
                      </Link>
                    ) : (
                      <p className="msg-requests__who">{who(x)}</p>
                    )}
                    <p className="msg-requests__meta">
                      {t("messages.req.wants", "Seninle yazışmak istiyor")}
                      {time && <> · {time}</>}
                    </p>
                  </div>
                </div>
                <div className="msg-requests__actions">
                  <Button
                    size="sm"
                    loading={busyId === x.threadId}
                    iconStart={<Icon name="check" size={16} />}
                    onClick={() => onRespond(x.threadId, "accept")}
                  >
                    {t("messages.req.accept", "Kabul et")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busyId === x.threadId}
                    onClick={() => onRespond(x.threadId, "decline")}
                  >
                    {t("messages.req.decline", "Reddet")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === x.threadId}
                    onClick={() => onRespond(x.threadId, "block")}
                  >
                    {t("messages.req.block", "Engelle")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {outgoing.length > 0 && (
        <ul className="msg-requests__list">
          {outgoing.map((x) => (
            <li key={x.threadId} className="msg-requests__item" data-surface="default">
              <div className="msg-requests__head">
                <Avatar name={who(x)} size="sm" decorative />
                <p className="msg-requests__who">{who(x)}</p>
              </div>
              <Badge tone="neutral">
                <Icon name="clock" size={16} />
                {t("messages.req.pending", "Yanıt bekleniyor")}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
