import React, { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import {
  Accordion,
  Button,
  Card,
  Chip,
  ChipGroup,
  CreditCostTable,
  Icon,
  Screen,
  ScreenHeader,
  TextField,
  Txt,
  type IconName,
} from "../ui";
import { homeText as t, type HomeKey } from "../i18n/home";
import { readShareCode, shareCodeUrl } from "../share/share-code";
import { GUEST_PROMPT_MAX } from "../guest/guest-draft";
import { tokens } from "../theme";

// Keşfet (misafir ana sekmesi; design §9 "Ana sayfa", §10, J6; kararlar S6/S7/S11). Web ana
// sayfasıyla aynı sıra ve aynı metin (i18n/home.ts = web home.*): hero girişi (→ Asistan sekmesi),
// yalnız alanı dolduran örnek çipler, "Paylaşım kodum var", nasıl çalışır, özellikler, bağımsızlık,
// kredi tablosu, paylaşım kodu, SSS. Mağaza rozeti, "uygulamayı indir" ya da "yakında" YOK (S6).
// Planlayıcı gövdesi ve paylaşım kartı native'e özgü metinle çizilir (S23: native'de sürükleme ve
// süreli/onaylı paylaşım oluşturma yok).
// LLM çağrısı ya da kredi işlemi yoktur; yalnızca yönlendirir.
export interface ExploreScreenProps {
  /** Hero metniyle Asistan sekmesini açar (misafir senaryosu, ağ çağrısı yok). */
  onStartAssistant: (prompt: string) => void;
  /** "Planları karşılaştır": native plan kartları (misafirde satın alma yok). */
  onOpenPlans: () => void;
}

const EXAMPLE_CHIPS: readonly HomeKey[] = [
  "home.hero.chips.rome",
  "home.hero.chips.cappadocia",
  "home.hero.chips.lisbon",
];
const TRUST: readonly HomeKey[] = [
  "home.hero.trust.ranking",
  "home.hero.trust.credits",
  "home.hero.trust.welcome",
];
const STEPS = [
  { n: 1, title: "home.how.step1.title", body: "home.how.step1.body" },
  { n: 2, title: "home.how.step2.title", body: "home.how.step2.body" },
  { n: 3, title: "home.how.step3.title", body: "home.how.step3.body" },
] as const;
const FEATURES: ReadonlyArray<{ icon: IconName; title: HomeKey; body: HomeKey }> = [
  { icon: "map", title: "home.features.planner.title", body: "native.home.features.planner.body" },
  { icon: "route", title: "home.features.optimize.title", body: "home.features.optimize.body" },
  { icon: "sparkle", title: "home.features.assistant.title", body: "home.features.assistant.body" },
  {
    icon: "share",
    title: "native.home.features.share.title",
    body: "native.home.features.share.body",
  },
  { icon: "message", title: "home.features.messages.title", body: "home.features.messages.body" },
  { icon: "users", title: "home.features.community.title", body: "home.features.community.body" },
];
const INDEPENDENCE = [
  { title: "home.independence.p1.title", body: "home.independence.p1.body" },
  { title: "home.independence.p2.title", body: "home.independence.p2.body" },
  { title: "home.independence.p3.title", body: "home.independence.p3.body" },
] as const;
// SSS q4 (web tarayıcı önbelleği) ve q5 (dil seçimi) native'de geçerli değil (I10, home.ts notu).
const FAQ = [
  { id: "sss-1", q: "home.faq.q1", a: "home.faq.a1" },
  { id: "sss-2", q: "home.faq.q2", a: "home.faq.a2" },
  { id: "sss-3", q: "home.faq.q3", a: "home.faq.a3" },
] as const;

/** Hero/kapanış girişi: metin → Asistan; çipler yalnızca alanı doldurur. */
function HeroPrompt({
  withChips,
  onSubmit,
}: {
  withChips?: boolean;
  onSubmit: (prompt: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const trimmed = query.trim();
  return (
    <View style={styles.prompt}>
      <TextField
        label={t("home.hero.inputLabel")}
        value={query}
        onChangeText={setQuery}
        placeholder={t("home.hero.inputPlaceholder")}
        maxLength={GUEST_PROMPT_MAX}
        returnKeyType="go"
        onSubmitEditing={() => trimmed && onSubmit(trimmed)}
      />
      <Button
        label={t("home.hero.submit")}
        size="lg"
        disabled={!trimmed}
        icon={<Icon name="arrow" size={20} color={tokens.color.buttonPrimaryFg} />}
        onPress={() => onSubmit(trimmed)}
      />
      {withChips ? (
        <>
          <ChipGroup label={t("home.hero.chips.label")} labelHidden mode="single">
            {EXAMPLE_CHIPS.map((key) => (
              <Chip key={key} pressed={query === t(key)} onPress={() => setQuery(t(key))}>
                {t(key)}
              </Chip>
            ))}
            <Chip icon="key" pressed={codeOpen} onPress={() => setCodeOpen((open) => !open)}>
              {t("home.hero.chips.shareCode")}
            </Chip>
          </ChipGroup>
          {codeOpen ? <ShareCodeForm /> : null}
        </>
      ) : null}
    </View>
  );
}

/** Paylaşım kodu (karar S16 kuralı) → web görüntüleyicisi /k/?code= (hesapsız açılır). */
function ShareCodeForm() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const submit = () => {
    const code = readShareCode(value);
    if (!code) {
      setError(t("home.share.error"));
      return;
    }
    setError(undefined);
    Linking.openURL(shareCodeUrl(code)).catch(() => setError(t("home.share.error")));
  };
  return (
    <View style={styles.prompt}>
      <TextField
        label={t("home.share.label")}
        value={value}
        error={error}
        maxLength={80}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={(next) => {
          setValue(next);
          if (error) setError(undefined);
        }}
        onSubmitEditing={submit}
      />
      <Button label={t("home.share.submit")} variant="secondary" size="lg" onPress={submit} />
    </View>
  );
}

function SectionHead({ title, sub, eyebrow }: { title: string; sub?: string; eyebrow?: string }) {
  return (
    <View style={styles.sectionHead}>
      {eyebrow ? (
        <Txt variant="eyebrow" tone="highlight">
          {eyebrow}
        </Txt>
      ) : null}
      <Txt variant="title" header>
        {title}
      </Txt>
      {sub ? <Txt tone="muted">{sub}</Txt> : null}
    </View>
  );
}

export function ExploreScreen({ onStartAssistant, onOpenPlans }: ExploreScreenProps) {
  return (
    <Screen scroll keyboardAvoiding header={<ScreenHeader variant="brand" />}>
      <View style={styles.page}>
        <View style={styles.hero}>
          <Txt variant="eyebrow" tone="highlight">
            {t("home.hero.eyebrow")}
          </Txt>
          <Txt variant="display" header>
            {t("home.hero.title")}
          </Txt>
          <Txt tone="muted">{t("home.hero.sub")}</Txt>
          <HeroPrompt withChips onSubmit={onStartAssistant} />
          <View style={styles.list}>
            {TRUST.map((key) => (
              <View key={key} style={styles.row}>
                <Icon name="check" size={16} color={tokens.color.success} />
                <Txt variant="small" style={styles.flex}>
                  {t(key)}
                </Txt>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHead eyebrow={t("home.how.eyebrow")} title={t("home.how.title")} />
          {STEPS.map((step) => (
            <Card key={step.n} variant="bordered">
              <View style={styles.row}>
                <View style={styles.stepNum}>
                  <Txt variant="label" tone="inverse">
                    {String(step.n)}
                  </Txt>
                </View>
                <View style={styles.flex}>
                  <Txt variant="heading" header>
                    {t(step.title)}
                  </Txt>
                  <Txt variant="small" tone="muted">
                    {t(step.body)}
                  </Txt>
                </View>
              </View>
            </Card>
          ))}
        </View>

        <View style={styles.section}>
          <SectionHead title={t("home.features.title")} />
          {FEATURES.map((f) => (
            <Card key={f.icon} variant="bordered">
              <View style={styles.row}>
                <View style={styles.featureIcon}>
                  <Icon name={f.icon} size={24} color={tokens.color.textBrand} />
                </View>
                <View style={styles.flex}>
                  <Txt variant="heading" header>
                    {t(f.title)}
                  </Txt>
                  <Txt variant="small" tone="muted">
                    {t(f.body)}
                  </Txt>
                </View>
              </View>
            </Card>
          ))}
        </View>

        <Card variant="inverse">
          <View style={styles.band}>
            <Txt variant="title" tone="inverse" header>
              {t("home.independence.title")}
            </Txt>
            <Txt tone="inverseMuted">{t("home.independence.sub")}</Txt>
            {INDEPENDENCE.map((p) => (
              <View key={p.title} style={styles.row}>
                <Icon name="check" size={24} color={tokens.color.textInverse} />
                <View style={styles.flex}>
                  <Txt variant="heading" tone="inverse" header>
                    {t(p.title)}
                  </Txt>
                  <Txt variant="small" tone="inverseMuted">
                    {t(p.body)}
                  </Txt>
                </View>
              </View>
            ))}
          </View>
        </Card>

        <View style={styles.section}>
          <SectionHead title={t("home.credits.title")} sub={t("home.credits.sub")} />
          <CreditCostTable />
          <Button label={t("home.credits.cta")} variant="secondary" onPress={onOpenPlans} />
        </View>

        <View style={styles.section}>
          <SectionHead title={t("home.share.title")} sub={t("home.share.sub")} />
          <ShareCodeForm />
        </View>

        <View style={styles.section}>
          <SectionHead title={t("home.faq.title")} />
          <Accordion
            items={FAQ.map((item) => ({
              id: item.id,
              summary: t(item.q),
              content: (
                <Txt variant="small" tone="muted">
                  {t(item.a)}
                </Txt>
              ),
            }))}
          />
        </View>

        <View style={styles.section}>
          <SectionHead title={t("home.final.title")} />
          <HeroPrompt onSubmit={onStartAssistant} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: tokens.space["5"],
    paddingBottom: tokens.space["12"],
    gap: tokens.space["10"],
  },
  hero: { gap: tokens.space["4"] },
  prompt: { gap: tokens.space["3"] },
  section: { gap: tokens.space["4"] },
  sectionHead: { gap: tokens.space["2"] },
  list: { gap: tokens.space["2"] },
  row: { flexDirection: "row", alignItems: "flex-start", gap: tokens.space["3"] },
  flex: { flex: 1, gap: tokens.space["1"] },
  stepNum: {
    width: tokens.touch.min - 12,
    height: tokens.touch.min - 12,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  featureIcon: {
    width: tokens.touch.min,
    height: tokens.touch.min,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surfaceBrand,
    alignItems: "center",
    justifyContent: "center",
  },
  band: { gap: tokens.space["4"] },
});
