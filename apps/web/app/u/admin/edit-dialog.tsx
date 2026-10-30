"use client";
// Alan şemalı düzenleme dialogu (design §8.6, §6.2): görünür etiketler, istemci doğrulaması
// (otorite sunucudadır), hata özeti role=alert + ilk hatalı alana odak, zorunlu gerekçe.
// Sunucu hatası dialog içinde Alert olarak gösterilir; dialog açık kalır, girilen veri korunur.
// confirmDiff: kaydetmeden önce önce/sonra tablosu (plan/paket/Stripe değişikliği).
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  type ModalSize,
} from "../../components/ui";
import { useRefreshHold } from "./use-area-data";

export type FieldSpec = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select" | "checkbox" | "password" | "datetime" | "multi";
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  /** number: tam sayı zorunlu */
  integer?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: { re: RegExp; message: string };
  hint?: ReactNode;
  autoComplete?: string;
  /** Değer gönderilmez (ör. boş bırakılmış gizli anahtar). */
  omitEmpty?: boolean;
};

type Raw = string | boolean | string[];
export type FormValues = Record<string, string | number | boolean | string[] | undefined>;

export const REASON_MIN = 3;
export const REASON_MAX = 1000;

function toRaw(spec: FieldSpec, value: unknown): Raw {
  if (spec.type === "checkbox") return value === true;
  if (spec.type === "multi") return Array.isArray(value) ? value.map(String) : [];
  if (value === undefined || value === null) return "";
  return String(value);
}

function validate(spec: FieldSpec, raw: Raw): string | null {
  if (spec.type === "checkbox" || spec.type === "multi") return null;
  const text = String(raw).trim();
  if (!text) return spec.required ? `${spec.label} gerekli.` : null;
  if (spec.maxLength && text.length > spec.maxLength)
    return `${spec.label} en fazla ${spec.maxLength} karakter olabilir.`;
  if (spec.type === "number") {
    const n = Number(text);
    if (!Number.isFinite(n) || (spec.integer && !Number.isSafeInteger(n)))
      return `${spec.label} ${spec.integer ? "tam sayı" : "sayı"} olmalı.`;
    if (spec.min !== undefined && n < spec.min) return `${spec.label} en az ${spec.min} olmalı.`;
    if (spec.max !== undefined && n > spec.max)
      return `${spec.label} en fazla ${spec.max} olabilir.`;
  }
  if (spec.type === "datetime" && !Number.isFinite(Date.parse(text)))
    return `${spec.label} geçerli bir tarih olmalı.`;
  if (spec.pattern && !spec.pattern.re.test(text)) return spec.pattern.message;
  return null;
}

function convert(spec: FieldSpec, raw: Raw): FormValues[string] {
  if (spec.type === "checkbox" || spec.type === "multi") return raw;
  const text = String(raw).trim();
  if (!text) return spec.omitEmpty || !spec.required ? undefined : text;
  if (spec.type === "number") return Number(text);
  if (spec.type === "datetime") return new Date(text).toISOString();
  return text;
}

const display = (v: unknown) =>
  v === undefined || v === null || v === ""
    ? "—"
    : Array.isArray(v)
      ? v.join(", ") || "—"
      : typeof v === "boolean"
        ? v
          ? "Evet"
          : "Hayır"
        : String(v);

export function EditDialog({
  open,
  title,
  description,
  fields,
  initial = {},
  reason = true,
  submitLabel = "Kaydet",
  tone = "primary",
  size = "md",
  confirmDiff = false,
  typedConfirmation,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  fields: FieldSpec[];
  initial?: Record<string, unknown>;
  /** false: gerekçe alanı yok. Varsayılan: zorunlu gerekçe (3–1000). */
  reason?: boolean;
  submitLabel?: string;
  tone?: "primary" | "danger";
  size?: ModalSize;
  confirmDiff?: boolean;
  /** Değerlere göre yazılı onay metni (ör. admin rolüne yükseltmede e-posta); null → gerekmez. */
  typedConfirmation?: (values: FormValues) => string | null;
  onSubmit: (values: FormValues, reason: string) => Promise<void>;
  onClose: () => void;
}) {
  useRefreshHold(open);
  const formId = useId();
  const baseId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [raw, setRaw] = useState<Record<string, Raw>>({});
  const [reasonText, setReasonText] = useState("");
  const [typed, setTyped] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<FormValues | null>(null);

  const initialKey = JSON.stringify(initial);
  useEffect(() => {
    if (!open) return;
    const init = JSON.parse(initialKey) as Record<string, unknown>;
    setRaw(Object.fromEntries(fields.map((f) => [f.name, toRaw(f, init[f.name])])));
    setReasonText("");
    setTyped("");
    setErrors({});
    setServerError(null);
    setReview(null);
    setBusy(false);
    // fields kimliği her render'da yeni olabilir; yalnızca açılışta sıfırlanır.
  }, [open, initialKey]);

  const fieldId = (name: string) => `${baseId}-${name}`;

  function collect(): FormValues | null {
    const next: Record<string, string> = {};
    for (const f of fields) {
      const msg = validate(f, raw[f.name] ?? "");
      if (msg) next[f.name] = msg;
    }
    if (reason) {
      const r = reasonText.trim();
      if (r.length < REASON_MIN || r.length > REASON_MAX)
        next.__reason = `Gerekçe ${REASON_MIN}–${REASON_MAX} karakter olmalı.`;
    }
    const values: FormValues = {};
    for (const f of fields) {
      const v = convert(f, raw[f.name] ?? "");
      if (v !== undefined) values[f.name] = v;
    }
    const expected = typedConfirmation?.(values);
    if (expected && typed.trim() !== expected) next.__typed = `Onaylamak için "${expected}" yazın.`;
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      window.requestAnimationFrame(() => {
        const target = document.getElementById(fieldId(first));
        (target ?? summaryRef.current)?.focus();
      });
      return null;
    }
    return values;
  }

  async function commit(values: FormValues) {
    setBusy(true);
    setServerError(null);
    try {
      await onSubmit(values, reasonText.trim());
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Beklenmeyen hata. Tekrar deneyin.");
      setReview(null);
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (busy) return;
    if (review) return void commit(review);
    const values = collect();
    if (!values) return;
    if (confirmDiff) setReview(values);
    else void commit(values);
  }

  const init = JSON.parse(initialKey) as Record<string, unknown>;
  const changes = review
    ? fields.filter((f) => display(review[f.name]) !== display(init[f.name]))
    : [];
  const errorList = Object.entries(errors);
  const labelOf = (key: string) =>
    key === "__reason"
      ? "Gerekçe"
      : key === "__typed"
        ? "Yazılı onay"
        : (fields.find((f) => f.name === key)?.label ?? key);
  const expected = typedConfirmation?.(
    Object.fromEntries(fields.map((f) => [f.name, convert(f, raw[f.name] ?? "")])),
  );

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      description={description}
      size={size}
      dismissible={!busy}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => (review ? setReview(null) : onClose())}
            disabled={busy}
          >
            {review ? "Düzenlemeye dön" : "İptal"}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            type="submit"
            form={formId}
            loading={busy}
            disabled={review !== null && changes.length === 0}
          >
            {review ? "Değişiklikleri onayla" : submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="admin-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {errorList.length > 0 && (
          <div ref={summaryRef} tabIndex={-1}>
            <Alert tone="danger" live="assertive" title="Lütfen şu alanları düzeltin">
              <ul className="admin-form__errors">
                {errorList.map(([k, msg]) => (
                  <li key={k}>
                    <a href={`#${fieldId(k)}`}>{labelOf(k)}</a>: {msg}
                  </li>
                ))}
              </ul>
            </Alert>
          </div>
        )}
        {review ? (
          <div className="admin-form__diff">
            {changes.length === 0 ? (
              <p>Değişiklik yok.</p>
            ) : (
              <table className="admin-diff">
                <caption className="ui-visually-hidden">Önce ve sonra</caption>
                <thead>
                  <tr>
                    <th scope="col">Alan</th>
                    <th scope="col">Önce</th>
                    <th scope="col">Sonra</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((f) => (
                    <tr key={f.name}>
                      <th scope="row">{f.label}</th>
                      <td>{f.type === "password" ? "••••" : display(init[f.name])}</td>
                      <td>{f.type === "password" ? "•••• (yeni)" : display(review[f.name])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <>
            {fields.map((f) => (
              <FieldControl
                key={f.name}
                spec={f}
                id={fieldId(f.name)}
                value={raw[f.name] ?? toRaw(f, undefined)}
                error={errors[f.name]}
                onChange={(v) => setRaw((prev) => ({ ...prev, [f.name]: v }))}
              />
            ))}
            {reason && (
              <Field
                id={fieldId("__reason")}
                label="Gerekçe"
                hint="İşlem geçmişine yazılır (3–1000 karakter)."
                error={errors.__reason}
                required
              >
                {(ids) => (
                  <Textarea
                    {...ids}
                    value={reasonText}
                    maxLength={REASON_MAX}
                    rows={2}
                    onChange={(e) => setReasonText(e.target.value)}
                  />
                )}
              </Field>
            )}
            {expected && (
              <Field
                id={fieldId("__typed")}
                label={`Onaylamak için yazın: ${expected}`}
                error={errors.__typed}
                required
              >
                {(ids) => (
                  <Input
                    {...ids}
                    value={typed}
                    autoComplete="off"
                    onChange={(e) => setTyped(e.target.value)}
                  />
                )}
              </Field>
            )}
          </>
        )}
        {serverError && (
          <Alert tone="danger" live="assertive">
            {serverError}
          </Alert>
        )}
      </form>
    </Modal>
  );
}

function FieldControl({
  spec,
  id,
  value,
  error,
  onChange,
}: {
  spec: FieldSpec;
  id: string;
  value: Raw;
  error?: string;
  onChange: (v: Raw) => void;
}) {
  if (spec.type === "checkbox")
    return (
      <Checkbox
        label={spec.label}
        hint={spec.hint}
        checked={value === true}
        onChange={(c) => onChange(c)}
        variant="switch"
      />
    );
  if (spec.type === "multi") {
    const list = Array.isArray(value) ? value : [];
    return (
      <fieldset className="admin-form__group">
        <legend className="admin-form__legend">{spec.label}</legend>
        {(spec.options ?? []).map((o) => (
          <Checkbox
            key={o.value}
            label={o.label}
            checked={list.includes(o.value)}
            onChange={(c) => onChange(c ? [...list, o.value] : list.filter((x) => x !== o.value))}
          />
        ))}
      </fieldset>
    );
  }
  return (
    <Field
      id={id}
      label={spec.label}
      hint={spec.hint}
      error={error}
      required={spec.required}
      optionalLabel={spec.required ? undefined : "isteğe bağlı"}
    >
      {(ids) =>
        spec.type === "textarea" ? (
          <Textarea
            {...ids}
            value={String(value)}
            maxLength={spec.maxLength}
            rows={4}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : spec.type === "select" ? (
          <Select {...ids} value={String(value)} onChange={(e) => onChange(e.target.value)}>
            {!spec.required && <option value="">Seçin</option>}
            {(spec.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            {...ids}
            type={
              spec.type === "number"
                ? "number"
                : spec.type === "password"
                  ? "password"
                  : spec.type === "datetime"
                    ? "datetime-local"
                    : "text"
            }
            inputMode={spec.type === "number" ? "numeric" : undefined}
            value={String(value)}
            maxLength={spec.maxLength}
            autoComplete={spec.type === "password" ? "off" : (spec.autoComplete ?? "off")}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      }
    </Field>
  );
}
