"use client";
// Ana sayfa giriş bileşenleri (design §10): HeroPrompt (hero ve kapanış, farklı id'lerle) ve
// ShareCodeForm (hero çipi ve #paylasim). Yalnızca yönlendirir; LLM çağrısı ya da kredi işlemi
// yoktur. Paylaşım kodu kuralı tek yerde: lib/share/share-code.ts readShareCode (S16).
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Chip,
  ChipGroup,
  Field,
  Icon,
  Input,
  VisuallyHidden,
  type ButtonVariant,
} from "./components/ui";
import { useLocale } from "./lib/locale-context";
import { readShareCode } from "./lib/share/share-code";

/** design §12.2: hero/composer metni en çok 500 karakter. */
export const PROMPT_MAX_LENGTH = 500;

const EXAMPLE_CHIPS = [
  "home.hero.chips.rome",
  "home.hero.chips.cappadocia",
  "home.hero.chips.lisbon",
] as const;

export function HeroPrompt({
  idPrefix,
  withChips = false,
  submitVariant = "primary",
}: {
  idPrefix: string;
  withChips?: boolean;
  submitVariant?: ButtonVariant;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed) return;
    router.push(`/travel-assistant/?q=${encodeURIComponent(trimmed.slice(0, PROMPT_MAX_LENGTH))}`);
  }

  return (
    <div className="home-prompt">
      <form className="home-prompt__form" onSubmit={submit}>
        <Field
          id={`${idPrefix}-q`}
          label={t("home.hero.inputLabel")}
          className="home-prompt__field"
        >
          <Input
            ref={inputRef}
            id={`${idPrefix}-q`}
            size="lg"
            value={query}
            maxLength={PROMPT_MAX_LENGTH}
            placeholder={t("home.hero.inputPlaceholder")}
            autoComplete="off"
            enterKeyHint="go"
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          variant={submitVariant}
          disabled={!trimmed}
          className="home-prompt__submit"
          iconEnd={<Icon name="arrow" size={20} />}
        >
          {t("home.hero.submit")}
        </Button>
      </form>
      {withChips && (
        <>
          <ChipGroup
            mode="single"
            label={<VisuallyHidden>{t("home.hero.chips.label")}</VisuallyHidden>}
            className="home-prompt__chips"
          >
            {EXAMPLE_CHIPS.map((key) => {
              const text = t(key);
              return (
                <Chip
                  key={key}
                  pressed={query === text}
                  onPress={() => {
                    setQuery(text);
                    inputRef.current?.focus();
                  }}
                >
                  {text}
                </Chip>
              );
            })}
            <Chip icon="key" pressed={codeOpen} onPress={() => setCodeOpen((open) => !open)}>
              {t("home.hero.chips.shareCode")}
            </Chip>
          </ChipGroup>
          {codeOpen && <ShareCodeForm idPrefix={`${idPrefix}-code`} autoFocus />}
        </>
      )}
    </div>
  );
}

export function ShareCodeForm({
  idPrefix,
  autoFocus = false,
}: {
  idPrefix: string;
  autoFocus?: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const code = readShareCode(value);
    if (!code) {
      setError(t("home.share.error"));
      inputRef.current?.focus();
      return;
    }
    setError(null);
    router.push(`/k/?code=${encodeURIComponent(code)}`);
  }

  return (
    <form className="home-code" onSubmit={submit} noValidate>
      <Field
        id={`${idPrefix}-input`}
        label={t("home.share.label")}
        error={error}
        className="home-code__field"
      >
        <Input
          ref={inputRef}
          id={`${idPrefix}-input`}
          size="lg"
          value={value}
          maxLength={80}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="home-code__input"
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
        />
      </Field>
      <Button type="submit" size="lg" variant="secondary" className="home-code__submit">
        {t("home.share.submit")}
      </Button>
    </form>
  );
}
