"use client";
// "Mesaj istekleri" kutusu (Increment 1.14, M1/M2): bana gelen istekler Kabul / Reddet / Engelle;
// gönderdiğim istekler "Yanıt bekleniyor". Veri GET /chat/threads (request durumu sunucudan).
import { Badge, Button, Icon } from "../components/ui";
import type { ChatThreadSummary } from "../lib/api-client";
import type { RequestAction } from "../features/messaging/requests";
import { useLocale } from "../lib/locale-context";

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
  const { t } = useLocale();
  if (incoming.length === 0 && outgoing.length === 0) return null;
  const who = (x: ChatThreadSummary) =>
    x.otherParticipant || t("messages.req.someone", "Bir gezgin");
  return (
    <section className="msg-requests" aria-labelledby="msg-requests-title">
      <h3 id="msg-requests-title" className="msg-requests__title">
        <Icon name="inbox" size={16} />
        {t("messages.req.title", "Mesaj istekleri ({n})").replace("{n}", String(incoming.length))}
      </h3>
      {incoming.length > 0 && (
        <ul className="msg-requests__list">
          {incoming.map((x) => (
            <li key={x.threadId} className="msg-requests__item" data-surface="default">
              <p className="msg-requests__who">{who(x)}</p>
              <div className="msg-requests__actions">
                <Button
                  size="sm"
                  loading={busyId === x.threadId}
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
          ))}
        </ul>
      )}
      {outgoing.length > 0 && (
        <ul className="msg-requests__list">
          {outgoing.map((x) => (
            <li key={x.threadId} className="msg-requests__item" data-surface="default">
              <p className="msg-requests__who">{who(x)}</p>
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
