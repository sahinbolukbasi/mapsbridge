import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { CloseIcon, CheckIcon, TrashIcon, TagIcon, MapPinIcon } from "./Icons";
import { socialSyncService, MobileCommunityPost } from "../services/socialSync";

import { ModalFrame } from "../ui";
import { tokens } from "../theme";
interface EditPostModalProps {
  visible: boolean;
  post: MobileCommunityPost | null;
  onClose: () => void;
  onSaved: (updatedPost: MobileCommunityPost) => void;
  onDeleted: (postId: string) => void;
}

export function EditPostModal({ visible, post, onClose, onSaved, onDeleted }: EditPostModalProps) {
  if (!post) return null;

  const [content, setContent] = useState(post.content);
  const [locationTag, setLocationTag] = useState(post.locationTag || "");
  const [hashtagsText, setHashtagsText] = useState((post.hashtags || []).join(" "));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert("Eksik İçerik", "Paylaşım metni boş bırakılamaz.");
      return;
    }

    setSaving(true);
    try {
      const parsedTags = hashtagsText
        .split(" ")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => (t.startsWith("#") ? t : `#${t}`));

      const updated = await socialSyncService.editPost(post.id, {
        content: content.trim(),
        locationTag: locationTag.trim() || undefined,
        hashtags: parsedTags.length > 0 ? parsedTags : ["#Keşif"],
      });

      if (updated) {
        onSaved(updated);
        onClose();
      }
    } catch {
      Alert.alert("Hata", "Gönderi güncellenirken bir sorun oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Gönderiyi Sil",
      "Bu gezi paylaşımınızı kalıcı olarak silmek istediğinize emin misiniz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            await socialSyncService.deletePost(post.id);
            onDeleted(post.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <ModalFrame
      visible={visible}
      variant="fullscreen"
      animation="slide"
      onRequestClose={onClose}
      style={styles.safeArea}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Top Bar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={onClose} activeOpacity={0.7}>
            <CloseIcon size={20} color={tokens.color.textBrand} />
          </TouchableOpacity>
          <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.headerTitle}>
            Gönderiyi Düzenle
          </Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <CheckIcon size={16} color={tokens.color.onPrimary} />
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.saveBtnText}>
              {saving ? "..." : "Güncelle"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Main content input */}
          <View style={styles.formGroup}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.label}>
              GÖNDERİ METNİ
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={content}
              onChangeText={setContent}
              placeholder="Seyahat deneyiminizi veya rota ipuçlarınızı yazın..."
              placeholderTextColor={tokens.color.neutral400}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          {/* Location Tag */}
          <View style={styles.formGroup}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.label}>
              KONUM ETİKETİ
            </Text>
            <View style={styles.inputWithIcon}>
              <MapPinIcon size={16} color={tokens.color.accent} />
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0, paddingLeft: 6 }]}
                value={locationTag}
                onChangeText={setLocationTag}
                placeholder="Örn: Roma, İtalya"
                placeholderTextColor={tokens.color.neutral400}
              />
            </View>
          </View>

          {/* Hashtags */}
          <View style={styles.formGroup}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.label}>
              ETİKETLER (BOŞLUKLA AYIRIN)
            </Text>
            <View style={styles.inputWithIcon}>
              <TagIcon size={16} color={tokens.color.accent} />
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0, paddingLeft: 6 }]}
                value={hashtagsText}
                onChangeText={setHashtagsText}
                placeholder="#Doğa #Yürüyüş #Keşif"
                placeholderTextColor={tokens.color.neutral400}
              />
            </View>
          </View>

          {/* Delete button */}
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
            <TrashIcon size={16} color={tokens.color.danger} />
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.deleteBtnText}>
              Bu Gönderiyi Sil
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.color.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.surfaceTint,
    backgroundColor: tokens.color.surface,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.color.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  saveBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.color.link,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.surfaceTint,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: tokens.color.textBrand,
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.surfaceTint,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  textArea: {
    minHeight: 120,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: tokens.color.dangerBorder,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  deleteBtnText: {
    color: tokens.color.danger,
    fontSize: 14,
    fontWeight: "800",
  },
});
