import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  AuthGate,
  Button,
  ComposerBar,
  Icon,
  MessageBubble,
  MessageLog,
  QuestionCard,
  Screen,
  ScreenHeader,
  TextField,
  Txt,
  type CardQuestions,
  type QuestionAnswers,
} from "../ui";
import {
  GUEST_TURNS,
  guestOption,
  nextTurn,
  sanitizeAnswers,
  validateDateRange,
  type DateRangeError,
  type GuestAnswers,
  type GuestTurn,
} from "../guest/guest-script";
import {
  GUEST_PROMPT_MAX,
  buildGuestSummaryMessage,
  createDraft,
  loadDraft,
  sanitizePrompt,
  saveDraft,
  type GuestDraft,
} from "../guest/guest-draft";
import { GUEST_OWNER } from "../services/trip-owner";
import { storage } from "../services/storage";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";

// Misafir asistan (design §6.1, §6.2, J1; karar S7): web GuestAssistant ile aynı akış ve metin.
// Yalnızca istemci: ağ çağrısı, LLM ya da kredi durumu YOK. Tur 1/2 sabit soru seti
// (guest/guest-script.ts), tur 3 "Taslak rotamı oluştur · 5 kredi" → AuthGate sheet. Taslak
// AsyncStorage `mapsbridge.guestDraft.v1` (aynı şema/TTL). Ücretli istek yalnızca kayıttan sonra,
// kullanıcı dokununca AIScreen'den sunucu kredi zinciriyle gider.
export interface GuestAssistantViewProps {
  /** Keşfet hero metni (her yeni gönderimde `nonce` değişir). */
  prompt?: { text: string; nonce: number };
  onRegister: () => void;
  onLogin: () => void;
  /** "Şimdilik haritada devam et" → Planla. */
  onOpenPlanner: () => void;
}

function toCardQuestions(turn: GuestTurn): CardQuestions {
  return turn.questions.map((q) => ({
    id: q.id,
    text: q.text,
    mode: q.mode,
    max: q.max,
    options: q.options.map((o) => ({ id: o.id, label: o.label })),
  })) as unknown as CardQuestions;
}

function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2030-01-05" → "05.01.2030" (Hermes Intl'e bağımlı değil). */
function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso;
}

function turnLabels(turn: 1 | 2, a: GuestAnswers): string[] {
  const label = (q: "duration" | "character" | "pace" | "interests", id: string) =>
    guestOption(q, id)?.label ?? "";
  if (turn === 1) {
    const d = a.duration;
    const duration =
      typeof d === "object" && d
        ? `${formatDay(d.from)} – ${formatDay(d.to)}`
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

const DATE_ERRORS: Record<DateRangeError, Parameters<typeof tr>[0]> = {
  invalid: "guest.dates.error.invalid",
  order: "guest.dates.error.order",
  past: "guest.dates.error.past",
  tooLong: "guest.dates.error.tooLong",
};

/** "Tarih seç": YYYY-AA-GG alanları (design §12.2: from ≤ to, from ≥ bugün, ≤ 30 gün). */
function DateRangeCard({ onSubmit }: { onSubmit: (from: string, to: string) => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<DateRangeError | null>(null);
  return (
    <View style={styles.card}>
      <Txt variant="heading" header>
        {tr("guest.dates.title")}
      </Txt>
      <TextField
        label={tr("guest.dates.from")}
        hint="YYYY-AA-GG"
        value={from}
        onChangeText={setFrom}
        placeholder={localToday()}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <TextField
        label={tr("guest.dates.to")}
        hint="YYYY-AA-GG"
        value={to}
        onChangeText={setTo}
        error={error ? tr(DATE_ERRORS[error]) : undefined}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <Button
        label={tr("assistant.question.submit")}
        onPress={() => {
          const err = validateDateRange(from.trim(), to.trim(), localToday());
          setError(err);
          if (!err) onSubmit(from.trim(), to.trim());
        }}
      />
    </View>
  );
}

/** Taslak özeti + "Taslak rotamı oluştur · 5 kredi" (misafirde kapı, oturumluda gönderim). */
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
  blockedReason?: string;
  secondary?: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Txt variant="heading" header>
        {tr("guest.summary.title")}
      </Txt>
      <Txt variant="small">{buildGuestSummaryMessage(draft)}</Txt>
      <Button
        label={tr("guest.summary.create")}
        size="lg"
        cost={5}
        loading={busy}
        disabled={Boolean(blockedReason)}
        hint={blockedReason}
        onPress={onCreate}
      />
      {secondary}
      {blockedReason ? (
        <Txt variant="caption" tone="warning">
          {blockedReason}
        </Txt>
      ) : null}
    </View>
  );
}

export function GuestAssistantView({
  prompt,
  onRegister,
  onLogin,
  onOpenPlanner,
}: GuestAssistantViewProps) {
  const [draft, setDraft] = useState<GuestDraft | null>(null);
  const [storageWarn, setStorageWarn] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [pendingDates, setPendingDates] = useState<GuestAnswers | null>(null);
  const warned = useRef(false);
  const draftRef = useRef<GuestDraft | null>(null);
  draftRef.current = draft;

  const persist = (next: GuestDraft) => {
    const answers = sanitizeAnswers(next.answers);
    const clean: GuestDraft = { ...next, answers, turn: next.q ? nextTurn(answers) : 0 };
    setDraft(clean);
    saveDraft(storage, clean, GUEST_OWNER).then((ok) => {
      if (!ok && !warned.current) {
        warned.current = true;
        setStorageWarn(true);
      }
    });
  };

  // Açılışta kayıtlı taslak (7 gün). Keşfet'ten gelen metin taslaktakiyle aynıysa (ya da metin
  // yoksa) kayıtlı taslak sürer, farklıysa yeni taslak başlar (web GuestAssistant kuralı).
  const loaded = useRef(false);
  const pendingQ = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadDraft(storage, GUEST_OWNER, Date.now()).then((stored) => {
      if (!alive) return;
      loaded.current = true;
      const q = pendingQ.current;
      pendingQ.current = null;
      if (stored && (!q || stored.q === q)) setDraft(stored);
      else if (q) persist(createDraft(q, Date.now()));
      else setDraft(createDraft("", Date.now()));
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!prompt) return;
    const q = sanitizePrompt(prompt.text);
    if (!q) return;
    if (!loaded.current) {
      pendingQ.current = q;
      return;
    }
    if (draftRef.current?.q === q) return;
    setPendingDates(null);
    persist(createDraft(q, Date.now()));
    // persist yalnızca setState + depolama yazar.
  }, [prompt?.nonce]);

  const header = (
    <ScreenHeader
      title={tr("guest.head.title")}
      subtitle={tr("guest.head.sub")}
      left={
        <View style={styles.avatar}>
          <Icon name="sparkle" size={20} color={tokens.color.onPrimary} />
        </View>
      }
    />
  );

  if (!draft) return <Screen header={header} />;

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
  const answerTurn2 = (answers: QuestionAnswers) =>
    persist({
      ...draft,
      answers: {
        ...draft.answers,
        pace: answers.pace?.[0],
        interests: answers.interests,
      } as GuestAnswers,
    });

  // iOS duyurusu: son asistan metni (Android canlı bölgeyi okur).
  const announcement =
    turn === 3
      ? tr("guest.summary.title")
      : turn === 2
        ? tr("guest.turn2.intro")
        : draft.q
          ? tr("guest.turn1.intro")
          : tr("guest.intro");

  return (
    <Screen header={header} keyboardAvoiding>
      {storageWarn ? (
        <View style={styles.alert} accessibilityLiveRegion="polite">
          <Txt variant="small" tone="warning">
            Taslağın bu cihazda saklanamıyor; uygulamayı kapatırsan kaybolur.
          </Txt>
        </View>
      ) : null}
      <MessageLog label={tr("assistant.log.label")} announcement={announcement}>
        <MessageBubble role="assistant">{tr("guest.intro")}</MessageBubble>
        {draft.q ? <MessageBubble role="user">{draft.q}</MessageBubble> : null}
        {draft.q ? <MessageBubble role="assistant">{tr("guest.turn1.intro")}</MessageBubble> : null}
        {turn === 1 ? (
          pendingDates ? (
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
              questions={toCardQuestions(turn1)}
              onSubmit={answerTurn1}
              note={tr("guest.note.free")}
            />
          )
        ) : null}
        {turn >= 2 ? (
          <>
            <MessageBubble role="user">{turnLabels(1, draft.answers).join(" · ")}</MessageBubble>
            <MessageBubble role="assistant">{tr("guest.turn2.intro")}</MessageBubble>
          </>
        ) : null}
        {turn === 2 ? (
          <QuestionCard
            questions={toCardQuestions(turn2)}
            onSubmit={answerTurn2}
            note={tr("guest.note.free")}
          />
        ) : null}
        {turn === 3 ? (
          <>
            <MessageBubble role="user">{turnLabels(2, draft.answers).join(" · ")}</MessageBubble>
            <GuestDraftSummary
              draft={draft}
              onCreate={() => setGateOpen(true)}
              blockedReason={draft.q ? undefined : tr("guest.summary.needPlace")}
              secondary={
                <Button label={tr("guest.summary.toMap")} variant="ghost" onPress={onOpenPlanner} />
              }
            />
          </>
        ) : null}
      </MessageLog>
      {!draft.q ? (
        <View style={styles.composer}>
          <ComposerBar
            placeholder={tr("guest.composer.placeholder")}
            maxLength={GUEST_PROMPT_MAX}
            onSubmit={(text) => {
              const q = sanitizePrompt(text);
              if (q) persist({ ...draft, q });
            }}
          />
        </View>
      ) : null}
      <AuthGate
        variant="sheet"
        reason="ai"
        draft
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        onRegister={() => {
          setGateOpen(false);
          onRegister();
        }}
        onLogin={() => {
          setGateOpen(false);
          onLogin();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: tokens.touch.min - 8,
    height: tokens.touch.min - 8,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    gap: tokens.space["3"],
    padding: tokens.space["4"],
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surface,
  },
  alert: {
    margin: tokens.space["4"],
    padding: tokens.space["3"],
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.alertInfoBorder,
    backgroundColor: tokens.color.alertInfoBg,
  },
  composer: {
    padding: tokens.space["3"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.border,
    backgroundColor: tokens.color.composerBg,
  },
});
