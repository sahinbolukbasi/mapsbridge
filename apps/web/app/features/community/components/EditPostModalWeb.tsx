"use client";

import React, { useState } from "react";
import type { CommunityPost } from "../types";
import { SoftIcon } from "../../../components/soft-icon";
import "../community-layout.css";
import { Modal } from "../../../components/ui";

interface EditPostModalWebProps {
  post: CommunityPost;
  isOpen?: boolean;
  onClose: () => void;
  onSave: (
    postId: string,
    updates: { content?: string; category?: string; locationTag?: string; hashtags?: string[] },
  ) => void;
  onDelete: (postId: string) => void;
}

export function EditPostModalWeb({
  post,
  isOpen = true,
  onClose,
  onSave,
  onDelete,
}: EditPostModalWebProps) {
  if (isOpen === false) return null;

  const [content, setContent] = useState(post.content);
  const [category, setCategory] = useState(post.category || "Tarih & Kültür");
  const [locationTag, setLocationTag] = useState(post.locationTag || "");
  const [hashtags, setHashtags] = useState((post.hashtags || []).join(" "));
  const [saving, setSaving] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSaving(true);
    const parsedTags = hashtags
      .split(" ")
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith("#") ? t : `#${t}`));

    onSave(post.id, {
      content: content.trim(),
      category,
      locationTag: locationTag.trim() || undefined,
      hashtags: parsedTags.length > 0 ? parsedTags : undefined,
    });
    setSaving(false);
    onClose();
  };

  const handleDelete = () => {
    if (
      window.confirm("Bu seyahat paylaşımınızı kalıcı olarak silmek istediğinize emin misiniz?")
    ) {
      onDelete(post.id);
      onClose();
    }
  };

  return (
    <Modal open onClose={onClose} title="Gönderiyi Düzenle" size="md" className="edit-post-dialog">
      {/* Form Body */}
      <form onSubmit={handleSubmit} className="p-6 cm-22">
        <div>
          <label className="block cm-77 uppercase tracking-wider mb-1.5">İçerik Metni</label>
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="cm-78 py-2.5 focus:ring-2 focus:ring-emerald-500/20 placeholder-slate-400 resize-none"
            placeholder="Seyahat deneyiminizi güncelleyin..."
            required
          />
        </div>

        <div className="cm-79">
          <div>
            <label className="block cm-77 uppercase tracking-wider mb-1.5">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="cm-80 focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="Tarih & Kültür">Tarih & Kültür</option>
              <option value="Doğa & Macera">Doğa & Macera</option>
              <option value="Gastronomi">Gastronomi</option>
              <option value="Fotoğraf & Rota">Fotoğraf & Rota</option>
              <option value="Sırt Çantası">Sırt Çantası</option>
            </select>
          </div>

          <div>
            <label className="block cm-77 uppercase tracking-wider mb-1.5">Konum Etiketi</label>
            <div className="cm-81">
              <span className="cm-82 left-3">
                <SoftIcon name="map-pin" size={14} color="#059669" />
              </span>
              <input
                type="text"
                value={locationTag}
                onChange={(e) => setLocationTag(e.target.value)}
                placeholder="Örn: Roma, İtalya"
                className="cm-83 pl-8 pr-3 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block cm-77 uppercase tracking-wider mb-1.5">
            Etiketler (Hashtags)
          </label>
          <div className="cm-81">
            <span className="cm-82 left-3">
              <SoftIcon name="tag" size={14} color="#059669" />
            </span>
            <input
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#Roma #Gastronomi #İtalya"
              className="cm-83 pl-8 pr-3 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="cm-84 pt-4 mt-6">
          <button
            type="button"
            onClick={handleDelete}
            className="cm-85 text-rose-600 hover:bg-rose-50 border-rose-200"
          >
            <SoftIcon name="trash" size={14} color="#e11d48" />
            <span>Gönderiyi Sil</span>
          </button>

          <div className="cm-51">
            <button type="button" onClick={onClose} className="px-4 cm-86 cm-u-text-600">
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={saving || !content.trim()}
              className="cm-87 cm-u-shadow-sm"
            >
              <SoftIcon name="check" size={14} color="#ffffff" />
              <span>{saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}</span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
