"use client";
import { useState, type FormEvent } from "react";
import { Button, Field, Input, Modal, Select, Textarea } from "../../../components/ui";
import { useLocale } from "../../../lib/locale-context";
import { CATEGORY_LABEL_KEY, FEED_CATEGORIES } from "../../../lib/community/feed";
import type { CommunityPost } from "../types";

export type PostUpdates = {
  content?: string;
  category?: string;
  locationTag?: string;
  hashtags?: string[];
};

/** Gönderi düzenleme (Modal + Field primitive'leri). Silme ayrı ConfirmDialog'dadır. */
export function EditPostModalWeb({
  post,
  onClose,
  onSave,
}: {
  post: CommunityPost;
  onClose: () => void;
  onSave: (postId: string, updates: PostUpdates) => void;
}) {
  const { t } = useLocale();
  const [content, setContent] = useState(post.content);
  const [category, setCategory] = useState(post.category || FEED_CATEGORIES[1]);
  const [locationTag, setLocationTag] = useState(post.locationTag || "");
  const [hashtags, setHashtags] = useState((post.hashtags || []).join(" "));
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError(t("community.compose.required", "Paylaşım metni boş olamaz."));
      return;
    }
    const tags = hashtags
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.startsWith("#") ? s : `#${s}`));
    onSave(post.id, {
      content: content.trim(),
      category,
      locationTag: locationTag.trim() || undefined,
      hashtags: tags,
    });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("community.edit.title", "Paylaşımı düzenle")}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("ui.cancel", "Vazgeç")}
          </Button>
          <Button type="submit" form="cm-edit-form">
            {t("community.edit.save", "Kaydet")}
          </Button>
        </>
      }
    >
      <form id="cm-edit-form" className="cm-form" onSubmit={submit} noValidate>
        <Field label={t("community.compose.content", "Paylaşım metni")} error={error} required>
          {(ids) => (
            <Textarea
              {...ids}
              rows={5}
              maxLength={1000}
              value={content}
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
        <Field
          label={t("community.edit.hashtags", "Etiketler")}
          hint={t("community.edit.hashtagsHint", "Boşlukla ayır: #roma #yemek")}
          optionalLabel={t("ui.optional", "isteğe bağlı")}
        >
          {(ids) => (
            <Input
              {...ids}
              maxLength={200}
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
