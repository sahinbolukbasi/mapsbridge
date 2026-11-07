"use client";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  Badge,
  Button,
  Field,
  Icon,
  Input,
  Modal,
  Progress,
  Select,
  Textarea,
} from "../../../components/ui";
import { mediaApi } from "../../../lib/api-client";
import { EmojiPicker, insertAt } from "./EmojiPicker";
import { IMAGE_TYPES, prepareImage, uploadPostImage, validateImage } from "../media";
import { CATEGORY_LABEL_KEY, FEED_CATEGORIES, extractHashtags } from "../../../lib/community/feed";
import { useLocale } from "../../../lib/locale-context";
import type { Trip } from "../../../lib/trip/models";
import { PLANNER_TRIPS_KEY, readPlannerStore } from "../../../lib/trip/planner-store";
import type { CommunityPost } from "../types";

export type NewPostInput = {
  content: string;
  category: string;
  locationTag?: string;
  hashtags: string[];
  linkedRoute?: CommunityPost["linkedRoute"];
  /** Yüklenmiş görsel URL'i ya da (sunucu yüklemesi yoksa) cihaz-yerel data URL. */
  image?: string;
};

/** Planlayıcıdaki (bu hesaba ait) duraklı geziler; iliştirilen rota yalnızca gerçek duraklardan. */
function readPlannerTrips(): Trip[] {
  try {
    const raw = readPlannerStore(PLANNER_TRIPS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? (parsed as Trip[]).filter((t) => t && Array.isArray(t.pins) && t.pins.length > 0)
      : [];
  } catch {
    return [];
  }
}

function toLinkedRoute(trip: Trip): NonNullable<CommunityPost["linkedRoute"]> {
  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination || "",
    stopCount: trip.pins.length,
    stops: trip.pins.map((p) => ({
      label: p.label,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      category: p.category,
    })),
  };
}

/** Yeni paylaşım (Modal + Field). Yalnızca oturumlu kullanıcıya açılır; misafir kapıya düşer. */
export function NewPostModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: NewPostInput) => void;
}) {
  const { t } = useLocale();
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>(FEED_CATEGORIES[1]);
  const [locationTag, setLocationTag] = useState("");
  const [tripId, setTripId] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<{ src: string; deviceOnly: boolean } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (open) setTrips(readPlannerTrips());
  }, [open]);
  function reset() {
    setContent("");
    setLocationTag("");
    setTripId("");
    setError(null);
    setImage(null);
    setImageError(null);
    setProgress(null);
    setEmojiOpen(false);
  }
  async function pickFile(file: File | undefined) {
    if (!file) return;
    const check = validateImage(file);
    if (!check.ok) {
      setImageError(
        check.reason === "size"
          ? t("community.compose.imageTooLarge", "Görsel en fazla 10 MB olabilir.")
          : t("community.compose.imageType", "Yalnız JPG, PNG ya da WEBP görsel eklenebilir."),
      );
      return;
    }
    setImageError(null);
    setProgress(0);
    try {
      const prepared = await prepareImage(file);
      const url = await uploadPostImage(
        prepared,
        file.name,
        (name, type) => mediaApi.getPresignedUpload(name, type, "traveler-photos"),
        setProgress,
      );
      setImage(url ? { src: url, deviceOnly: false } : { src: prepared.dataUrl, deviceOnly: true });
    } catch {
      setImageError(
        t("community.compose.imageFailed", "Görsel hazırlanamadı. Başka bir görsel dene."),
      );
    } finally {
      setProgress(null);
    }
  }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    void pickFile(e.dataTransfer.files?.[0]);
  }
  function addEmoji(emoji: string) {
    const el = textRef.current;
    const next = insertAt(content, emoji, el?.selectionStart, el?.selectionEnd);
    if (next.text.length > 1000) return;
    setContent(next.text);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) {
      setError(t("community.compose.required", "Paylaşım metni boş olamaz."));
      // Boş gönderim: composer sallanır (yalnız no-preference, ui.css .ui-shake), odak metinde.
      const form = formRef.current;
      if (form) {
        form.classList.remove("ui-shake");
        void form.offsetWidth;
        form.classList.add("ui-shake");
      }
      textRef.current?.focus();
      return;
    }
    const trip = trips.find((x) => x.id === tripId);
    onSubmit({
      content: text,
      category,
      locationTag: locationTag.trim() || undefined,
      hashtags: extractHashtags(text),
      linkedRoute: trip ? toLinkedRoute(trip) : undefined,
      image: image?.src,
    });
    reset();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("community.compose.title", "Seyahat deneyimini paylaş")}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("ui.cancel", "Vazgeç")}
          </Button>
          <Button type="submit" form="cm-new-post-form" disabled={progress !== null}>
            {t("community.compose.submit", "Paylaş")}
          </Button>
        </>
      }
    >
      <form
        ref={formRef}
        id="cm-new-post-form"
        className="cm-form"
        onSubmit={submit}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.classList.remove("ui-shake");
        }}
        noValidate
      >
        <Field
          label={t("community.compose.content", "Paylaşım metni")}
          hint={t("community.compose.contentHint", "#etiket yazarsan gönderiye eklenir.")}
          error={error}
          required
        >
          {(ids) => (
            <Textarea
              {...ids}
              ref={textRef}
              rows={5}
              maxLength={1000}
              value={content}
              placeholder={t("community.compose.placeholder", "Nereyi keşfettin?")}
              onChange={(e) => {
                setContent(e.target.value);
                if (error) setError(null);
              }}
            />
          )}
        </Field>
        <div className="cm-compose__tools">
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={emojiOpen}
            aria-controls="cm-emoji-panel"
            iconStart={<Icon name="sparkle" size={16} />}
            onClick={() => setEmojiOpen((v) => !v)}
          >
            {t("community.emoji.toggle", "Emoji")}
          </Button>
        </div>
        {emojiOpen && (
          <div id="cm-emoji-panel">
            <EmojiPicker onPick={addEmoji} />
          </div>
        )}
        <Field
          label={t("community.compose.image", "Fotoğraf")}
          optionalLabel={t("ui.optional", "isteğe bağlı")}
          hint={t("community.compose.imageHint", "JPG, PNG ya da WEBP · en fazla 10 MB")}
          error={imageError}
        >
          {(ids) => (
            <div
              className="cm-drop"
              data-dragging={dragging || undefined}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                {...ids}
                ref={fileRef}
                type="file"
                accept={IMAGE_TYPES.join(",")}
                className="ui-visually-hidden"
                onChange={(e) => {
                  void pickFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {image ? (
                <div className="cm-drop__preview">
                  <img
                    src={image.src}
                    alt={t("community.compose.imagePreview", "Seçilen fotoğrafın önizlemesi")}
                    className="cm-drop__img"
                  />
                  <div className="cm-drop__meta">
                    {image.deviceOnly && (
                      <Badge tone="example">
                        <Icon name="offline" size={16} />
                        {t("community.post.deviceOnly", "Yalnız bu cihazda")}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      iconStart={<Icon name="trash" size={16} />}
                      onClick={() => setImage(null)}
                    >
                      {t("community.compose.imageRemove", "Fotoğrafı kaldır")}
                    </Button>
                  </div>
                </div>
              ) : progress !== null ? (
                <div className="cm-drop__progress">
                  <Progress
                    variant="determinate"
                    label={t("community.compose.uploading", "Fotoğraf yükleniyor")}
                    max={100}
                    value={Math.round(progress * 100)}
                    showValue
                  />
                  <p className="cm-drop__hint">
                    {t("community.compose.uploading", "Fotoğraf yükleniyor")}
                  </p>
                </div>
              ) : (
                <>
                  <Icon name="image" size={24} />
                  <p className="cm-drop__hint">
                    {t("community.compose.dropHint", "Fotoğrafı buraya sürükle ya da")}
                  </p>
                  <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                    {t("community.compose.chooseImage", "Fotoğraf seç")}
                  </Button>
                </>
              )}
            </div>
          )}
        </Field>
        <Field label={t("community.compose.category", "Kategori")}>
          {(ids) => (
            <Select {...ids} value={category} onChange={(e) => setCategory(e.target.value)}>
              {FEED_CATEGORIES.filter((c) => c !== "all").map((c) => (
                <option key={c} value={c}>
                  {t(CATEGORY_LABEL_KEY[c], c)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label={t("community.compose.location", "Konum")}
          optionalLabel={t("ui.optional", "isteğe bağlı")}
        >
          {(ids) => (
            <Input
              {...ids}
              maxLength={120}
              value={locationTag}
              onChange={(e) => setLocationTag(e.target.value)}
            />
          )}
        </Field>
        {trips.length > 0 && (
          <Field
            label={t("community.compose.route", "Rota iliştir")}
            optionalLabel={t("ui.optional", "isteğe bağlı")}
          >
            {(ids) => (
              <Select {...ids} value={tripId} onChange={(e) => setTripId(e.target.value)}>
                <option value="">{t("community.compose.noRoute", "Rota yok")}</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </form>
    </Modal>
  );
}
