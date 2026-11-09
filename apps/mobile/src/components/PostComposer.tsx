import React, { useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { socialSyncService, type MobileCommunityPost } from "../services/socialSync";
import type { ActiveRoute } from "../services/tripStore";
import {
  Button,
  Chip,
  Icon,
  IconButton,
  Media,
  ModalFrame,
  Notice,
  Progress,
  TextField,
  Txt,
  haptic,
  motion,
} from "../ui";
import { tr, type UiKey } from "../i18n/ui";
import { tokens } from "../theme";
import { EMOJIS, insertAt } from "../community/emoji";
import { currentPosition } from "../services/nearby";
import { placesApi } from "../trip/places-api";
// Paylaşım yazma (web NewPostModal karşılığı, Increment 4.4, M3): fotoğraf seçme (expo-image-picker),
// JPG/PNG/WEBP ≤ 10 MB doğrulaması, önizleme + kaldır, presign yükleme ilerlemesi; yükleme olmazsa
// görsel cihazda kalır ve "Yalnız bu cihazda" rozeti görünür. Emoji seçici içerik METNİNE emoji
// ekler (R3: içerik metni serbest; ikon olarak emoji yok). Boş gönderimde alan sallanır + ipucu.
// Not: istemcide ≤1600 px küçültme expo-image-manipulator ister (onaylı değil); seçici kalitesi
// 0.8 ile sıkıştırılır, boyut sınırı korunur.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Seçilen görselin doğrulaması (web ile aynı sınırlar). */
export function validateImage(asset: {
  mimeType?: string | null;
  fileSize?: number | null;
}): "ok" | "type" | "size" {
  const type = (asset.mimeType ?? "").toLowerCase();
  if (!IMAGE_TYPES.includes(type as (typeof IMAGE_TYPES)[number])) return "type";
  if (typeof asset.fileSize === "number" && asset.fileSize > MAX_IMAGE_BYTES) return "size";
  return "ok";
}
type Picked = { uri: string; deviceOnly: boolean };
export interface PostComposerProps {
  visible: boolean;
  onClose: () => void;
  activeRoute: ActiveRoute;
  onPublished: (post: MobileCommunityPost) => void;
}
export function PostComposer({ visible, onClose, activeRoute, onPublished }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [locationTag, setLocationTag] = useState("");
  const [locating, setLocating] = useState(false); // G7: otomatik konum
  const [attachRoute, setAttachRoute] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [image, setImage] = useState<Picked | null>(null);
  const [upload, setUpload] = useState<number | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  // G7: cihaz konumundan yer etiketini otomatik doldur (en sade). Konum yoksa sessizce vazgeçer;
  // izin/konum hatası paylaşımı bloklamaz (etiket elle de girilebilir). KVKK: tek seferlik, saklamaz.
  const useMyLocation = async () => {
    setLocating(true);
    try {
      const pos = await currentPosition();
      if (!pos) return;
      const { places } = await placesApi.reverse(pos.lat, pos.lng, "tr");
      const best = places?.[0];
      const label = (best?.name || best?.address || "").trim();
      if (label) setLocationTag(label.slice(0, 80));
    } catch {
      // yoksayılır
    } finally {
      setLocating(false);
    }
  };
  const runShake = () => {
    const d = tokens.motion.distance.sm * 2;
    const step = tokens.motion.duration.fast / 2;
    motion
      .sequence(
        [d, -d, d / 2, -d / 2, 0].map((v) =>
          motion.animate(shake, v, { duration: step, easing: "standard", useNativeDriver: true }),
        ),
      )
      .start();
    haptic("warning");
  };
  const pickImage = async () => {
    setImageError(null);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setImageError(tr("native.profile.photoPermission"));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const check = validateImage(asset);
      if (check !== "ok") {
        setImageError(
          tr(check === "type" ? "community.compose.imageType" : "community.compose.imageTooLarge"),
        );
        return;
      }
      setUpload(0);
      const url = await socialSyncService.uploadImage(
        asset.uri,
        (asset.mimeType ?? "image/jpeg").toLowerCase(),
        setUpload,
      );
      setImage(url ? { uri: url, deviceOnly: false } : { uri: asset.uri, deviceOnly: true });
      haptic("selection");
    } catch {
      setImageError(tr("community.compose.imageFailed"));
    } finally {
      setUpload(null);
    }
  };
  const addEmoji = (emoji: string) => {
    const next = insertAt(content, emoji, selection?.start, selection?.end);
    setContent(next.text);
    setSelection({ start: next.caret, end: next.caret });
    haptic("selection");
  };
  const reset = () => {
    setContent("");
    setLocationTag("");
    setAttachRoute(false);
    setImage(null);
    setError(null);
    setImageError(null);
    setEmojiOpen(false);
  };
  const publish = async () => {
    if (!content.trim()) {
      setError(tr("community.compose.required"));
      runShake();
      return;
    }
    if (upload !== null) return;
    setSending(true);
    try {
      const hashtags = [...new Set(content.match(/#[\p{L}\p{N}_]+/gu) ?? [])].slice(0, 6);
      const post = await socialSyncService.createPost({
        content: content.trim(),
        hashtags,
        locationTag: locationTag.trim() || undefined,
        mediaImage: image?.uri,
        routeAttachment:
          attachRoute && activeRoute.stops.length
            ? {
                id: `rt_user_${Date.now()}`,
                title: activeRoute.name,
                stats: tr("community.post.stops", { n: activeRoute.stops.length }),
                icon: "",
                stops: activeRoute.stops.map((s) => ({
                  id: s.id,
                  name: s.name,
                  category: s.category,
                  lat: s.lat,
                  lng: s.lng,
                  address: s.address,
                  duration: s.duration,
                })),
              }
            : undefined,
      });
      reset();
      onPublished(post);
    } catch {
      // Metin korunur; kullanıcı tekrar gönderebilir.
      setError(tr("native.community.publishFailed"));
    } finally {
      setSending(false);
    }
  };
  return (
    <ModalFrame
      visible={visible}
      variant="sheet"
      title={tr("community.compose.title")}
      onRequestClose={onClose}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ transform: [{ translateX: shake }] }}>
          <TextField
            label={tr("community.compose.content")}
            hint={tr("community.compose.contentHint")}
            placeholder={tr("community.compose.placeholder")}
            value={content}
            onChangeText={(t) => {
              setContent(t);
              if (error) setError(null);
            }}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            error={error ?? undefined}
            multiline
            maxLength={2000}
          />
        </Animated.View>
        <View style={styles.tools}>
          <Button
            label={tr("community.compose.chooseImage")}
            variant="secondary"
            size="sm"
            loading={upload !== null}
            loadingLabel={tr("community.compose.uploading")}
            onPress={pickImage}
          />
          <Button
            label={tr("community.emoji.toggle")}
            variant={emojiOpen ? "secondary" : "ghost"}
            size="sm"
            hint={tr("community.emoji.label")}
            onPress={() => setEmojiOpen((v) => !v)}
          />
        </View>
        <Txt variant="caption" tone="muted">
          {tr("community.compose.imageHint")}
        </Txt>
        {upload !== null ? (
          <Progress
            variant="determinate"
            label={tr("community.compose.uploading")}
            value={upload * 100}
          />
        ) : null}
        {imageError ? <Notice tone="danger">{imageError}</Notice> : null}
        {image ? (
          <View style={styles.preview}>
            <Media src={image.uri} alt={tr("community.compose.imagePreview")} ratio="4/3" />
            <View style={styles.previewBar}>
              {image.deviceOnly ? (
                <Txt variant="caption" tone="warning">
                  {tr("community.post.deviceOnly")}
                </Txt>
              ) : (
                <View />
              )}
              <IconButton
                icon="trash"
                label={tr("community.compose.imageRemove")}
                onPress={() => setImage(null)}
              />
            </View>
          </View>
        ) : null}
        {emojiOpen ? (
          <View role="group" accessibilityLabel={tr("community.emoji.label")} style={styles.emojis}>
            {EMOJIS.map(([emoji, key]) => (
              <EmojiKey
                key={key}
                emoji={emoji}
                label={tr(`community.emoji.${key}` as UiKey)}
                onPress={() => addEmoji(emoji)}
              />
            ))}
          </View>
        ) : null}
        <TextField
          label={tr("edit.location")}
          hint={tr("ui.optional")}
          value={locationTag}
          onChangeText={setLocationTag}
          maxLength={80}
        />
        <Button
          label={tr("native.community.useLocation")}
          variant="ghost"
          size="sm"
          loading={locating}
          icon={<Icon name="locate" size={16} color={tokens.color.buttonGhostFg} />}
          onPress={() => void useMyLocation()}
        />
        {activeRoute.stops.length ? (
          <Chip icon="route" pressed={attachRoute} onPress={() => setAttachRoute((v) => !v)}>
            {`${activeRoute.name} · ${tr("community.post.stops", { n: activeRoute.stops.length })}`}
          </Chip>
        ) : null}
        <Button
          label={tr("community.compose.submit")}
          size="lg"
          loading={sending}
          disabled={upload !== null}
          disabledReason={upload !== null ? tr("community.compose.uploading") : undefined}
          onPress={publish}
        />
      </ScrollView>
    </ModalFrame>
  );
}
/** Emoji tuşu: içerik metnidir; basınca küçük "pop" (motion.ts, reduce-motion'da yok). */
function EmojiKey({
  emoji,
  label,
  onPress,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        motion
          .sequence([
            motion.spring(scale, 1.25, "press", true),
            motion.spring(scale, 1, "press", true),
          ])
          .start();
        onPress();
      }}
      style={({ pressed }) => [styles.emojiKey, pressed ? styles.emojiPressed : null]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Text style={styles.emoji} maxFontSizeMultiplier={tokens.font.maxScale.compact}>
          {emoji}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  form: { padding: tokens.space["5"], gap: tokens.space["3"], paddingBottom: tokens.space["12"] },
  tools: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] },
  preview: { gap: tokens.space["1"] },
  previewBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  emojis: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space["1"] },
  emojiKey: {
    width: tokens.touch.min,
    height: tokens.touch.min,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.md,
  },
  emojiPressed: { backgroundColor: tokens.color.surfaceBrand },
  emoji: { fontSize: tokens.font.size.xl },
});
