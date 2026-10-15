"use client";

import React, { useState } from "react";
import type { CommunityPost } from "../types";
import { SoftIcon } from "../../../components/soft-icon";

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden transition-all transform scale-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <SoftIcon name="edit" size={16} color="#059669" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Gönderiyi Düzenle</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <SoftIcon name="close" size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              İçerik Metni
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm text-slate-800 placeholder-slate-400 resize-none"
              placeholder="Seyahat deneyiminizi güncelleyin..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs text-slate-700 bg-white"
              >
                <option value="Tarih & Kültür">Tarih & Kültür</option>
                <option value="Doğa & Macera">Doğa & Macera</option>
                <option value="Gastronomi">Gastronomi</option>
                <option value="Fotoğraf & Rota">Fotoğraf & Rota</option>
                <option value="Sırt Çantası">Sırt Çantası</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Konum Etiketi
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-emerald-600">
                  <SoftIcon name="map-pin" size={14} color="#059669" />
                </span>
                <input
                  type="text"
                  value={locationTag}
                  onChange={(e) => setLocationTag(e.target.value)}
                  placeholder="Örn: Roma, İtalya"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs text-slate-700"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Etiketler (Hashtags)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-emerald-600">
                <SoftIcon name="tag" size={14} color="#059669" />
              </span>
              <input
                type="text"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#Roma #Gastronomi #İtalya"
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs text-slate-700"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
            >
              <SoftIcon name="trash" size={14} color="#e11d48" />
              <span>Gönderiyi Sil</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={saving || !content.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
              >
                <SoftIcon name="check" size={14} color="#ffffff" />
                <span>{saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
