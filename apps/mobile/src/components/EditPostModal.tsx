import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { socialSyncService, type MobileCommunityPost } from "../services/socialSync";
import { Button, ConfirmDialog, ModalFrame, Notice, TextField } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";

// Paylaşımı düzenle / sil (FEAT-012: ModalFrame + primitive'ler). Kayıt ve silme bugünkü
// socialSyncService.editPost / deletePost çağrılarıyla; etiket boşsa uydurma "#Keşif" eklenmez.
interface EditPostModalProps {
  visible: boolean;
  post: MobileCommunityPost | null;
  onClose: () => void;
  onSaved: (updatedPost: MobileCommunityPost) => void;
  onDeleted: (postId: string) => void;
}

export function EditPostModal({ visible, post, onClose, onSaved, onDeleted }: EditPostModalProps) {
  const [content, setContent] = useState("");
  const [locationTag, setLocationTag] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!post) return;
    setContent(post.content);
    setLocationTag(post.locationTag || "");
    setHashtagsText((post.hashtags || []).join(" "));
    setError(null);
  }, [post?.id, visible]);

  if (!post) return null;

  const save = async () => {
    if (!content.trim()) {
      setError(tr("community.compose.required"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tags = hashtagsText
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : `#${t}`));
      const updated = await socialSyncService.editPost(post.id, {
        content: content.trim(),
        locationTag: locationTag.trim() || undefined,
        hashtags: tags,
      });
      if (updated) {
        onSaved(updated);
        onClose();
      } else setError(tr("ui.unexpectedError"));
    } catch {
      setError(tr("ui.unexpectedError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalFrame
      visible={visible}
      variant="sheet"
      title={tr("community.edit.title")}
      onRequestClose={onClose}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <TextField
          label={tr("community.compose.content")}
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={2000}
        />
        <TextField
          label={tr("edit.location")}
          hint={tr("ui.optional")}
          value={locationTag}
          onChangeText={setLocationTag}
          maxLength={80}
        />
        <TextField
          label={tr("community.edit.hashtags")}
          hint={`${tr("ui.optional")} · #roma #yemek`}
          value={hashtagsText}
          onChangeText={setHashtagsText}
          autoCapitalize="none"
          maxLength={160}
        />
        <View style={styles.actions}>
          <Button label={tr("community.edit.save")} size="lg" loading={saving} onPress={save} />
          <Button
            label={tr("community.post.delete")}
            variant="danger"
            onPress={() => setConfirm(true)}
          />
        </View>
      </ScrollView>
      <ConfirmDialog
        visible={confirm}
        title={tr("community.delete.title")}
        body={tr("community.delete.body")}
        confirmLabel={tr("community.delete.confirm")}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          await socialSyncService.deletePost(post.id);
          onDeleted(post.id);
          onClose();
        }}
      />
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  form: { padding: tokens.space["5"], gap: tokens.space["4"], paddingBottom: tokens.space["12"] },
  actions: { gap: tokens.space["2"] },
});
