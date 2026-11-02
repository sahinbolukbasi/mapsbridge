interface SlackEvent {
  type?: string;
  channel?: string;
  text?: string;
  bot_id?: string;
  subtype?: string;
}

interface SlackPayload {
  type?: string;
  challenge?: string;
  event_id?: string;
  event?: SlackEvent;
}

const seenEvents = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000;

function pruneSeen() {
  const now = Date.now();
  for (const [id, expiry] of seenEvents) {
    if (now > expiry) seenEvents.delete(id);
  }
}

export async function handleSlackEvent(
  body: string,
  headers: Record<string, string>,
  botToken: string,
): Promise<{ statusCode: number; body: string }> {
  let payload: SlackPayload;
  try {
    payload = JSON.parse(body) as SlackPayload;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  if (payload.type === "url_verification") {
    return { statusCode: 200, body: JSON.stringify({ challenge: payload.challenge }) };
  }

  if (payload.type !== "event_callback") {
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  const eventId = payload.event_id as string | undefined;

  if (eventId) {
    pruneSeen();
    if (seenEvents.has(eventId)) {
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    seenEvents.set(eventId, Date.now() + DEDUP_TTL_MS);
  }

  const event = payload.event || {};

  if (event.bot_id || event.subtype === "bot_message") {
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  if (event.type === "app_mention" || event.type === "message") {
    void processEvent(event, botToken).catch((err) =>
      console.error("[slack-events] process error", err),
    );
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
}

async function processEvent(event: SlackEvent, botToken: string): Promise<void> {
  const channel = event.channel;
  if (!channel || !botToken) return;

  const text: string = (event.text || "")
    .replace(/<[^>]+>/g, "")
    .trim()
    .toLowerCase();

  let response = "Desteklenen komutlar: `/deploy`, `/rollback`, `/status`, `/health`, `/logs`";
  if (text.includes("health") || text.includes("sağlık")) {
    response = "Servis durumu için `/health` komutunu kullanın.";
  } else if (text.includes("deploy") || text.includes("yayınla")) {
    response = "Deploy için `/deploy <servis>` komutunu kullanın. Admin yetkisi gereklidir.";
  }

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${botToken}` },
    body: JSON.stringify({ channel, text: response }),
  }).catch((err) => console.error("[slack-events] post error", err));
}
