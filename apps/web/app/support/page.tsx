"use client";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api-client";
import { getStoredSession } from "../lib/cognito";
type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  version: number;
  createdAt: string;
  messages: { author: string; body: string; createdAt: string }[];
};
const statuses: Record<string, string> = {
  open: "Açık",
  in_progress: "İnceleniyor",
  resolved: "Çözüldü",
  closed: "Kapatıldı",
};
export default function SupportPage() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("account");
  const [reply, setReply] = useState("");
  const requestId = useRef("");
  const sending = useRef(false);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setTickets((await apiFetch<{ tickets: Ticket[] }>("/support/tickets")).tickets);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Talepler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const signedIn = !!getStoredSession()?.token;
    setLoggedIn(signedIn);
    requestId.current = crypto.randomUUID();
    if (signedIn) void load();
  }, []);
  const send = async (event: React.FormEvent, isReply = false) => {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiFetch<{ ticket: Ticket }>(
        isReply ? `/support/tickets/${encodeURIComponent(ticket!.id)}/reply` : "/support/tickets",
        {
          method: "POST",
          body: JSON.stringify(
            isReply
              ? { message: reply, version: ticket!.version }
              : { subject, message, category, requestId: requestId.current },
          ),
        },
      );
      if (isReply) {
        setTicket(result.ticket);
        setReply("");
      } else {
        setSubject("");
        setMessage("");
        requestId.current = crypto.randomUUID();
      }
      setNotice(isReply ? "Yanıtınız kaydedildi." : "Destek talebiniz oluşturuldu.");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Talep kaydedilemedi.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return (
    <main className="support-page">
      <a href="/">← Ana sayfa</a>
      <h1>Yardım ve destek</h1>
      <p>Hesap, rota veya ödeme konularında destek ekibimizle iletişime geçin.</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
      {loggedIn === null ? (
        <p>Oturum kontrol ediliyor…</p>
      ) : !loggedIn ? (
        <section className="support-card">
          <p>Destek talebi oluşturmak ve yanıtları görmek için giriş yapın.</p>
          <a href="/login/">Giriş yap</a>
        </section>
      ) : (
        <div className="support-grid">
          <section className="support-card">
            <h2>Yeni talep</h2>
            <form onSubmit={(event) => void send(event)}>
              <label>
                Kategori
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={busy}
                >
                  <option value="account">Hesap ve erişim</option>
                  <option value="payment">Ödeme ve abonelik</option>
                  <option value="route">Rota ve paylaşım</option>
                  <option value="other">Diğer</option>
                </select>
              </label>
              <label>
                Konu
                <input
                  required
                  maxLength={160}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                Mesaj
                <textarea
                  required
                  maxLength={4000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={busy}
                />
              </label>
              <small>Parola veya kart bilgisi paylaşmayın.</small>
              <p>
                <button disabled={busy || !subject.trim() || !message.trim()}>
                  {busy ? "Gönderiliyor…" : "Talep oluştur"}
                </button>
              </p>
            </form>
          </section>
          <section className="support-card">
            <h2>Taleplerim</h2>
            <button disabled={loading || busy} onClick={() => void load()}>
              Yenile
            </button>
            {loading ? (
              <p>Yükleniyor…</p>
            ) : !tickets.length ? (
              <p>Henüz destek talebiniz yok.</p>
            ) : (
              tickets.map((item) => (
                <button
                  className="support-ticket-button"
                  key={item.id}
                  onClick={() => {
                    setTicket(item);
                    setReply("");
                  }}
                >
                  {item.subject}
                  <small>
                    {statuses[item.status]} · {new Date(item.createdAt).toLocaleDateString("tr-TR")}
                  </small>
                </button>
              ))
            )}
          </section>
        </div>
      )}
      {ticket && (
        <section className="support-card">
          <button onClick={() => setTicket(null)}>Kapat</button>
          <h2>{ticket.subject}</h2>
          <p>{statuses[ticket.status]}</p>
          {ticket.messages.map((item, index) => (
            <article
              className={`support-message ${item.author === "support" ? "staff" : ""}`}
              key={index}
            >
              <strong>{item.author === "support" ? "Destek ekibi" : "Siz"}</strong>
              <small>{new Date(item.createdAt).toLocaleString("tr-TR")}</small>
              <p>{item.body}</p>
            </article>
          ))}
          {ticket.status !== "closed" && (
            <form onSubmit={(event) => void send(event, true)}>
              <label>
                Yanıtınız
                <textarea
                  required
                  maxLength={4000}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  disabled={busy}
                />
              </label>
              <button disabled={busy || !reply.trim()}>Yanıt gönder</button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
