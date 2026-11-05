"use client";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api-client";
import { getStoredSession } from "../lib/cognito";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  PageShell,
  Section,
  Select,
  Textarea,
} from "../components/ui";
import "./support.css";
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
    <PageShell
      className="support-page-shell"
      header={
        <PageHeader
          description="Hesap, rota veya ödeme konularında destek ekibimizle iletişime geçin."
          breadcrumb={[{ label: "Ana sayfa", href: "/" }, { label: "Yardım ve destek" }]}
        />
      }
    >
      {error && (
        <Alert tone="danger" live="assertive">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert tone="success" live="polite">
          {notice}
        </Alert>
      )}
      {loggedIn === null ? (
        <LoadingState label="Oturum kontrol ediliyor…" />
      ) : !loggedIn ? (
        <div className="support-guest">
          <Card className="support-panel">
            <EmptyState
              icon="lock"
              title="Destek talepleri hesabına bağlıdır"
              description="Talep oluşturmak ve yanıtları görmek için giriş yap."
              action={
                <Button href="/login/?next=/support/" variant="primary">
                  Giriş yap
                </Button>
              }
            />
          </Card>
          <Card className="support-panel">
            <EmptyState
              icon="inbox"
              title="Hesabına giremiyor musun?"
              description={
                <>
                  <a href="mailto:destek@mapsbridge.com">destek@mapsbridge.com</a> adresine yaz ya
                  da <a href="/how-it-works/">nasıl çalışır</a> sayfasına göz at.
                </>
              }
            />
          </Card>
        </div>
      ) : (
        <div className="support-layout">
          <Card className="support-panel">
            <Section title="Yeni talep">
              <form className="support-form" onSubmit={(event) => void send(event)}>
                <Field label="Kategori">
                  {(ids) => (
                    <Select
                      {...ids}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={busy}
                    >
                      <option value="account">Hesap ve erişim</option>
                      <option value="payment">Ödeme ve abonelik</option>
                      <option value="route">Rota ve paylaşım</option>
                      <option value="other">Diğer</option>
                    </Select>
                  )}
                </Field>
                <Field label="Konu" required>
                  {(ids) => (
                    <Input
                      {...ids}
                      required
                      maxLength={160}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={busy}
                    />
                  )}
                </Field>
                <Field label="Mesaj" required hint="Parola veya kart bilgisi paylaşmayın.">
                  {(ids) => (
                    <Textarea
                      {...ids}
                      required
                      maxLength={4000}
                      rows={6}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={busy}
                    />
                  )}
                </Field>
                <div>
                  <Button
                    type="submit"
                    loading={busy}
                    disabled={!subject.trim() || !message.trim()}
                  >
                    {busy ? "Gönderiliyor…" : "Talep oluştur"}
                  </Button>
                </div>
              </form>
            </Section>
          </Card>
          <Card className="support-panel">
            <Section
              title="Taleplerim"
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={loading || busy}
                  onClick={() => void load()}
                >
                  Yenile
                </Button>
              }
            >
              {loading ? (
                <LoadingState />
              ) : !tickets.length ? (
                <EmptyState title="Henüz destek talebiniz yok." level={3} />
              ) : (
                <ul className="support-tickets">
                  {tickets.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="support-ticket"
                        onClick={() => {
                          setTicket(item);
                          setReply("");
                        }}
                      >
                        <span className="support-ticket__subject">{item.subject}</span>
                        <small className="support-ticket__meta">
                          {statuses[item.status]} ·{" "}
                          {new Date(item.createdAt).toLocaleDateString("tr-TR")}
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </Card>
        </div>
      )}
      {ticket && (
        <Card className="support-panel">
          <Section
            title={ticket.subject}
            description={statuses[ticket.status]}
            actions={
              <Button variant="ghost" size="sm" onClick={() => setTicket(null)}>
                Kapat
              </Button>
            }
          >
            {ticket.messages.map((item, index) => (
              <article
                className={`support-thread__message${item.author === "support" ? " support-thread__message--staff" : ""}`}
                key={index}
              >
                <strong>{item.author === "support" ? "Destek ekibi" : "Siz"}</strong>
                <small className="support-thread__time">
                  {new Date(item.createdAt).toLocaleString("tr-TR")}
                </small>
                <p className="support-thread__body">{item.body}</p>
              </article>
            ))}
            {ticket.status !== "closed" && (
              <form className="support-form" onSubmit={(event) => void send(event, true)}>
                <Field label="Yanıtınız" required>
                  {(ids) => (
                    <Textarea
                      {...ids}
                      required
                      maxLength={4000}
                      rows={5}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      disabled={busy}
                    />
                  )}
                </Field>
                <div>
                  <Button type="submit" loading={busy} disabled={!reply.trim()}>
                    Yanıt gönder
                  </Button>
                </div>
              </form>
            )}
          </Section>
        </Card>
      )}
    </PageShell>
  );
}
