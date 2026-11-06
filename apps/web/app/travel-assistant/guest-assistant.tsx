"use client";
// Misafir asistan (design §6.1, §6.2, §12.1; decision S7; J1). Yalnızca istemci: ağ çağrısı,
// LLM ya da kredi durumu YOK. Tur 0–2 istemcideki sabit soru setinden (lib/guest/guest-script),
// tur 3'te "Taslak rotamı oluştur · 5 kredi" AuthGate sheet'i açar; ücretli istek yalnızca
// kayıttan sonra, kullanıcı dokununca sunucu kredi zinciriyle gider (travel-assistant-client).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AuthGate } from "../components/auth-gate";
import { ComposerBar } from "../components/assistant/composer-bar";
import { MessageBubble, MessageLog } from "../components/assistant/message-log";
import { QuestionCard, type QuestionAnswers } from "../components/assistant/question-card";
import type { CardQuestions, LooseQuestion } from "../components/assistant/logic/question-limits";
import { Alert, Button, Field, Icon, Input, PageHeader, PageShell } from "../components/ui";
import {
  buildGuestSummaryMessage,
  createDraft,
  loadDraft,
  sanitizePrompt,
  saveDraft,
  GUEST_PROMPT_MAX,
  type DraftStorage,
  type GuestDraft,
} from "../lib/guest/guest-draft";
import {
  GUEST_TURNS,
  guestOption,
  nextTurn,
  sanitizeAnswers,
  validateDateRange,
  type DateRangeError,
  type GuestAnswers,
  type GuestTurn,
} from "../lib/guest/guest-script";
import { useLocale } from "../lib/locale-context";
import { ownedDraftStorage } from "../lib/guest/guest-draft-owner";

type Translate = (key: string, fallback?: string) => string;

export const RESUME_NEXT = "/travel-assistant/?resume=1";

/**
 * localStorage (hesap yalıtımlı: başka hesabın sahiplendiği taslak okunmaz) ya da null (gizli
 * mod/SecurityError). Yalnızca olay/effect içinde çağrılır.
 */
export function guestStorage(): DraftStorage | null {
  try {
    return ownedDraftStorage(window.localStorage);
  } catch {
    return null;
  }
}

/** Sabit soru setini QuestionCard sorularına çevirir (etiketler i18n). */
function toCardQuestions(turn: GuestTurn, t: Translate): CardQuestions {
  const qs: LooseQuestion[] = turn.questions.map((q) => ({
    id: q.id,
    text: t(q.textKey, q.text),
    mode: q.mode,
    max: q.max,
    options: q.options.map((o) => ({ id: o.id, label: t(o.labelKey, o.label) })),
  }));
  return qs as unknown as CardQuestions;
}

function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDay(iso: string, locale: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(locale === "en" ? "en-GB" : "tr-TR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

/** Bir turun yanıtlarının etiketleri (kullanıcı balonu). */
function turnLabels(turn: 1 | 2, a: GuestAnswers, t: Translate, locale: string): string[] {
  const label = (q: "duration" | "character" | "pace" | "interests", id: string) => {
    const o = guestOption(q, id);
    return o ? t(o.labelKey, o.label) : "";
  };
  if (turn === 1) {
    const d = a.duration;
    const duration =
      typeof d === "object" && d
        ? `${formatDay(d.from, locale)} – ${formatDay(d.to, locale)}`
        : d
          ? label("duration", d)
          : "";
    return [duration, a.character ? label("character", a.character) : ""].filter(Boolean);
  }
  return [
    a.pace ? label("pace", a.pace) : "",
    ...(a.interests ?? []).map((i) => label("interests", i)),
  ].filter(Boolean);
}

/**
 * Taslak özeti + "Taslak rotamı oluştur · 5 kredi". Misafirde kapıyı açar; oturumlu `?resume=1`
 * dalında kullanıcı dokununca özet mesajı mevcut send() ile gönderilir (otomatik istek yok).
 */
export function GuestDraftSummary({
  draft,
  onCreate,
  busy = false,
  blockedReason,
  secondary,
}: {
  draft: GuestDraft;
  onCreate: () => void;
  busy?: boolean;
  /** Verilirse oluşturma düğmesi devre dışıdır ve neden görünür yazılır (aria-describedby). */
  blockedReason?: string;
  secondary?: ReactNode;
}) {
  const { t } = useLocale();
  const reasonId = "as-guest-summary-reason";
  return (
    <section
      className="as-guest-summary"
      data-surface="default"
      aria-labelledby="as-guest-summary-title"
    >
      <h2 id="as-guest-summary-title" className="as-guest-summary__title">
        {t("guest.summary.title", "Yanıtların hazır")}
      </h2>
      <p className="as-guest-summary__text">{buildGuestSummaryMessage(draft, t)}</p>
      <div className="as-guest-summary__actions">
        <Button
          variant="primary"
          size="lg"
          cost={5}
          loading={busy}
          disabled={Boolean(blockedReason)}
          aria-describedby={blockedReason ? reasonId : undefined}
          onClick={onCreate}
        >
          {t("guest.summary.create", "Taslak rotamı oluştur")}
        </Button>
        {secondary}
      </div>
      {blockedReason && (
        <p id={reasonId} className="as-guest-summary__reason">
          {blockedReason}
        </p>
      )}
    </section>
  );
}

const DATE_ERRORS: Record<DateRangeError, [string, string]> = {
  invalid: ["guest.dates.error.invalid", "Geçerli bir başlangıç ve bitiş tarihi seç."],
  order: ["guest.dates.error.order", "Bitiş tarihi başlangıçtan önce olamaz."],
  past: ["guest.dates.error.past", "Başlangıç tarihi bugünden önce olamaz."],
  tooLong: ["guest.dates.error.tooLong", "Aralık en fazla 30 gün olabilir."],
};

/** "Tarih seç": tarih aralığı alanı (design §12.2: from ≤ to, from ≥ bugün, ≤ 30 gün). */
function DateRangeCard({ onSubmit }: { onSubmit: (from: string, to: string) => void }) {
  const { t } = useLocale();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<DateRangeError | null>(null);
  const today = localToday();
  return (
    <form
      className="as-guest-dates"
      data-surface="default"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const err = validateDateRange(from, to, today);
        setError(err);
        if (!err) onSubmit(from, to);
      }}
    >
      <h2 className="as-guest-dates__title">{t("guest.dates.title", "Tarihlerini seç")}</h2>
      <div className="as-guest-dates__fields">
        <Field label={t("guest.dates.from", "Başlangıç")} required>
          {(ids) => (
            <Input
              {...ids}
              type="date"
              min={today}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          )}
        </Field>
        <Field
          label={t("guest.dates.to", "Bitiş")}
          required
          error={error ? t(...DATE_ERRORS[error]) : null}
        >
          {(ids) => (
            <Input
              {...ids}
              type="date"
              min={from || today}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          )}
        </Field>
      </div>
      <div>
        <Button type="submit" variant="primary">
          {t("assistant.question.submit", "Devam")}
        </Button>
      </div>
    </form>
  );
}

export function GuestAssistant() {
  const { t, locale } = useLocale();
  const [draft, setDraft] = useState<GuestDraft | null>(null);
  const [storageWarn, setStorageWarn] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  /** Tur 1'de "Tarih seç" seçildi: tarih alanı bekleniyor (karakter yanıtı burada tutulur). */
  const [pendingDates, setPendingDates] = useState<GuestAnswers | null>(null);
  const warned = useRef(false);

  // URL q ve kayıtlı taslak yalnızca mount sonrası okunur (statik export; G21 useSearchParams yok).
  useEffect(() => {
    const now = Date.now();
    const q = sanitizePrompt(new URLSearchParams(window.location.search).get("q") ?? "");
    const stored = loadDraft(guestStorage(), now);
    if (stored && (!q || stored.q === q)) setDraft(stored);
    else setDraft(createDraft(q, now));
  }, []);

  function persist(next: GuestDraft) {
    const answers = sanitizeAnswers(next.answers);
    const clean: GuestDraft = {
      ...next,
      answers,
      turn: next.q ? nextTurn(answers) : 0,
    };
    setDraft(clean);
    const { persisted } = saveDraft(guestStorage(), clean);
    if (!persisted && !warned.current) {
      warned.current = true;
      setStorageWarn(true);
    }
  }

  if (!draft) {
    return (
      <PageShell className="as-guest-shell">
        <PageHeader variant="hidden" />
      </PageShell>
    );
  }

  // Soru kartları hedef yazılmadan da yanıtlanabilir (tur 0'ın composer'ı açık kalır); taslak
  // rotası ancak hedef yazılınca oluşturulabilir.
  const turn = nextTurn(draft.answers);
  const [turn1, turn2] = GUEST_TURNS;
  const answerTurn1 = (answers: QuestionAnswers) => {
    const duration = answers.duration?.[0];
    const character = answers.character?.[0];
    if (duration === "pick-dates") {
      setPendingDates({ character: character as GuestAnswers["character"] });
      return;
    }
    persist({ ...draft, answers: { ...draft.answers, duration, character } as GuestAnswers });
  };
  const answerTurn2 = (answers: QuestionAnswers) => {
    persist({
      ...draft,
      answers: {
        ...draft.answers,
        pace: answers.pace?.[0],
        interests: answers.interests,
      } as GuestAnswers,
    });
  };

  return (
    <PageShell className="as-guest-shell">
      <PageHeader variant="hidden" />
      <div className="as-guest">
        <section className="as-guest__chat" aria-labelledby="as-guest-title">
          <div className="as-guest__head">
            <span className="as-guest__avatar">
              <Icon name="sparkle" size={20} />
            </span>
            <div>
              <p id="as-guest-title" className="as-guest__title">
                {t("guest.head.title", "Gezi asistanı")}
              </p>
              <p className="as-guest__sub">
                {t("guest.head.sub", "Hesapsız deneme · yanıtların bu cihazda kalır")}
              </p>
            </div>
          </div>
          {storageWarn && (
            <div className="as-guest__alert">
              <Alert tone="info" live="polite">
                {t(
                  "guest.storageWarn",
                  "Taslağın bu cihazda saklanamıyor; sekmeyi kapatırsan kaybolur.",
                )}
              </Alert>
            </div>
          )}
          <MessageLog className="as-guest__log" label={t("assistant.log.label", "Sohbet")}>
            <MessageBubble role="assistant">
              {t(
                "guest.intro",
                "Merhaba. Nereye gitmek istediğini yaz; rotanı çizmeden önce birkaç şeyi birlikte netleştirelim.",
              )}
            </MessageBubble>
            {draft.q && <MessageBubble role="user">{draft.q}</MessageBubble>}
            {draft.q && (
              <MessageBubble role="assistant">
                {t(
                  "guest.turn1.intro",
                  "Güzel seçim. Rotanı çizmeden önce iki şeyi netleştirelim.",
                )}
              </MessageBubble>
            )}
            {turn === 1 &&
              (pendingDates ? (
                <DateRangeCard
                  onSubmit={(from, to) => {
                    persist({
                      ...draft,
                      answers: { ...draft.answers, ...pendingDates, duration: { from, to } },
                    });
                    setPendingDates(null);
                  }}
                />
              ) : (
                <QuestionCard
                  questions={toCardQuestions(turn1, t)}
                  onSubmit={answerTurn1}
                  note={t("guest.note.free", "Tercih netleştirme ücretsiz")}
                />
              ))}
            {turn >= 2 && (
              <>
                <MessageBubble role="user">
                  {turnLabels(1, draft.answers, t, locale).join(" · ")}
                </MessageBubble>
                <MessageBubble role="assistant">
                  {t("guest.turn2.intro", "Son iki soru: tempo ve ilgi alanların.")}
                </MessageBubble>
              </>
            )}
            {turn === 2 && (
              <QuestionCard
                questions={toCardQuestions(turn2, t)}
                onSubmit={answerTurn2}
                note={t("guest.note.free", "Tercih netleştirme ücretsiz")}
              />
            )}
            {turn === 3 && (
              <>
                <MessageBubble role="user">
                  {turnLabels(2, draft.answers, t, locale).join(" · ")}
                </MessageBubble>
                <GuestDraftSummary
                  draft={draft}
                  onCreate={() => setGateOpen(true)}
                  blockedReason={
                    draft.q
                      ? undefined
                      : t(
                          "guest.summary.needPlace",
                          "Taslak için önce nereye gitmek istediğini yaz.",
                        )
                  }
                  secondary={
                    <Button variant="ghost" href="/maps/">
                      {t("guest.summary.toMap", "Şimdilik haritada devam et")}
                    </Button>
                  }
                />
              </>
            )}
          </MessageLog>
          {!draft.q && (
            <div className="as-guest__composer">
              <ComposerBar
                placeholder={t("guest.composer.placeholder", "Nereye gitmek istiyorsun?")}
                maxLength={GUEST_PROMPT_MAX}
                onSubmit={(text) => {
                  const q = sanitizePrompt(text);
                  if (q) persist({ ...draft, q });
                }}
              />
            </div>
          )}
        </section>
        <aside className="as-guest__map" aria-label={t("guest.map.label", "Rota önizlemesi")}>
          <div className="as-guest__map-inner">
            <Icon name="map" size={24} />
            <p className="as-guest__map-title">{t("guest.map.title", "Rotan burada görünecek")}</p>
            <p className="as-guest__map-text">
              {t(
                "guest.map.text",
                "Hesap açıp taslağını oluşturduğunda duraklar gün gün haritada çizilir.",
              )}
            </p>
          </div>
        </aside>
      </div>
      <AuthGate
        variant="sheet"
        reason="ai"
        draft
        next={RESUME_NEXT}
        open={gateOpen}
        onClose={() => setGateOpen(false)}
      />
    </PageShell>
  );
}
