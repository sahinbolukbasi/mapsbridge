"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Field, Input, Modal, Select, Textarea } from "../../../components/ui";
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

  useEffect(() => {
    if (open) setTrips(readPlannerTrips());
  }, [open]);

  function reset() {
    setContent("");
    setLocationTag("");
    setTripId("");
    setError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) {
      setError(t("community.compose.required", "Paylaşım metni boş olamaz."));
      return;
    }
    const trip = trips.find((x) => x.id === tripId);
    onSubmit({
      content: text,
      category,
      locationTag: locationTag.trim() || undefined,
      hashtags: extractHashtags(text),
      linkedRoute: trip ? toLinkedRoute(trip) : undefined,
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
          <Button type="submit" form="cm-new-post-form">
            {t("community.compose.submit", "Paylaş")}
          </Button>
        </>
      }
    >
      <form id="cm-new-post-form" className="cm-form" onSubmit={submit} noValidate>
        <Field
          label={t("community.compose.content", "Paylaşım metni")}
          hint={t("community.compose.contentHint", "#etiket yazarsan gönderiye eklenir.")}
          error={error}
          required
        >
          {(ids) => (
            <Textarea
              {...ids}
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
