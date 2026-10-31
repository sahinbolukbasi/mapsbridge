import React, { useState, useEffect } from "react";
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
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CloseIcon, CheckIcon, MapPinIcon, CameraIcon, TrashIcon } from "./Icons";
import { socialSyncService, MobileUserProfile } from "../services/socialSync";

import { ModalFrame } from "../ui";
import { tokens, withAlpha } from "../theme";
export const AVATAR_PRESETS = [
  {
    id: "preset_1",
    label: "Kapadokya Kaşifi",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "preset_2",
    label: "Doğa Gezgini",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "preset_3",
    label: "Kültür & Şehir",
    url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "preset_4",
    label: "Sırt Çantalı",
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "preset_5",
    label: "Rota Avcısı",
    url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
  },
];

const TITLE_SUGGESTIONS = [
  "Doğa & Rota Kaşifi",
  "Sırt Çantalı Gezgin",
  "Kültür & Tarih Kaşifi",
  "Gastronomi & Şehir Avcısı",
  "Vadi & Kanyon Yürüyüşçüsü",
];

interface EditProfileModalProps {
  visible: boolean;
  profile?: MobileUserProfile | null;
  onClose: () => void;
  onSaved: (updated: MobileUserProfile) => void;
}

export function EditProfileModal({ visible, profile, onClose, onSaved }: EditProfileModalProps) {
  const [fullName, setFullName] = useState(profile?.fullName || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [travelTitle, setTravelTitle] = useState(profile?.travelTitle || "Doğa & Rota Kaşifi");
  const [bio, setBio] = useState(profile?.bio || "");
  const [location, setLocation] = useState(profile?.location || "İstanbul, Türkiye");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || AVATAR_PRESETS[0].url);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || "");
      setUsername(profile.username || "");
      setTravelTitle(profile.travelTitle || "Doğa & Rota Kaşifi");
      setBio(profile.bio || "");
      setLocation(profile.location || "İstanbul, Türkiye");
      if (profile.avatarUrl) {
        setAvatarUrl(profile.avatarUrl);
      }
    }
  }, [profile, visible]);

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "İzin Gerekli",
          "Profil fotoğrafı seçebilmek için galeri erişim izni gereklidir.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarUrl(result.assets[0].uri);
      }
    } catch (e) {
      console.warn("Image picker error:", e);
      Alert.alert("Hata", "Fotoğraf seçilirken bir hata oluştu.");
    }
  };

  const handleRemovePhoto = () => {
    setAvatarUrl("");
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert("Eksik Bilgi", "Lütfen adınızı ve soyadınızı giriniz.");
      return;
    }
    if (!username.trim()) {
      Alert.alert("Eksik Bilgi", "Lütfen bir kullanıcı adı belirleyiniz.");
      return;
    }

    setSaving(true);
    try {
      const cleanUsername = username
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "");
      const updated = await socialSyncService.updateUserProfile({
        fullName: fullName.trim(),
        username: cleanUsername,
        travelTitle: travelTitle.trim() || "Doğa & Rota Kaşifi",
        bio: bio.trim(),
        location: location.trim() || "Türkiye",
        avatarUrl: avatarUrl.trim() || undefined,
      });
      onSaved(updated);
      onClose();
    } catch {
      Alert.alert("Hata", "Profil güncellenirken bir sorun oluştu.");
    } finally {
      setSaving(false);
    }
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
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={onClose} activeOpacity={0.7}>
            <CloseIcon size={20} color={tokens.color.text} />
          </TouchableOpacity>
          <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.headerTitle}>
            Profili Düzenle
          </Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <CheckIcon size={16} color={tokens.color.onPrimary} />
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.saveBtnText}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Avatar Preview & Selection */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={handlePickPhoto}
              activeOpacity={0.85}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.avatarInitial}
                  >
                    {fullName ? fullName.charAt(0).toUpperCase() : "G"}
                  </Text>
                </View>
              )}
              <View style={styles.avatarBadge}>
                <CameraIcon size={13} color={tokens.color.onPrimary} />
              </View>
            </TouchableOpacity>

            <Text
              maxFontSizeMultiplier={tokens.font.maxScale.body}
              style={styles.avatarSectionTitle}
            >
              Profil Fotoğrafı
            </Text>

            {/* Upload from Gallery CTA */}
            <View style={styles.photoActionsRow}>
              <TouchableOpacity
                style={styles.pickPhotoBtn}
                onPress={handlePickPhoto}
                activeOpacity={0.8}
              >
                <CameraIcon size={16} color={tokens.color.onPrimary} />
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                  style={styles.pickPhotoBtnText}
                >
                  Galeriden Fotoğraf Seç
                </Text>
              </TouchableOpacity>

              {avatarUrl ? (
                <TouchableOpacity
                  style={styles.removePhotoBtn}
                  onPress={handleRemovePhoto}
                  activeOpacity={0.8}
                >
                  <TrashIcon size={14} color={tokens.color.danger} />
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.removePhotoBtnText}
                  >
                    Kaldır
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.avatarTip}>
              veya hazır gezgin avatarlarından birini seçin:
            </Text>

            {/* Avatar Presets Horizontal Scroll */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetScroll}
            >
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = avatarUrl === preset.url;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[styles.presetItem, isSelected && styles.presetItemSelected]}
                    onPress={() => setAvatarUrl(preset.url)}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: preset.url }} style={styles.presetImg} />
                    {isSelected && (
                      <View style={styles.presetCheckOverlay}>
                        <Text
                          maxFontSizeMultiplier={tokens.font.maxScale.body}
                          style={{
                            color: tokens.color.onPrimary,
                            fontSize: 11,
                            fontWeight: "bold",
                          }}
                        >
                          ✓
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Inputs Form */}
          <View style={styles.formGroup}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.label}>
              AD SOYAD
            </Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Örn: Canberk Yılmaz"
              placeholderTextColor={tokens.color.neutral400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.label}>
              KULLANICI ADI
            </Text>
            <View style={styles.inputWithPrefix}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.inputPrefix}>
                @
              </Text>
              <TextInput
                style={[styles.input, styles.inputNoBorder]}
                value={username}
                onChangeText={setUsername}
                placeholder="canberk"
                placeholderTextColor={tokens.color.neutral400}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.label}>
              SEYAHAT UNVANI
            </Text>
            <TextInput
              style={styles.input}
              value={travelTitle}
              onChangeText={setTravelTitle}
              placeholder="Örn: Doğa & Kültür Kaşifi"
              placeholderTextColor={tokens.color.neutral400}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionChipsRow}
            >
              {TITLE_SUGGESTIONS.map((sug, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.sugChip, travelTitle === sug && styles.sugChipActive]}
                  onPress={() => setTravelTitle(sug)}
                >
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.compact}
                    style={[styles.sugChipText, travelTitle === sug && styles.sugChipTextActive]}
                  >
                    {sug}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.formGroup}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.label}>
              KONUM
            </Text>
            <View style={styles.inputWithPrefix}>
              <MapPinIcon size={16} color={tokens.color.successStrong} />
              <TextInput
                style={[styles.input, styles.inputNoBorder]}
                value={location}
                onChangeText={setLocation}
                placeholder="Örn: İstanbul, Türkiye"
                placeholderTextColor={tokens.color.neutral400}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.label}>
              BİYOGRAFİ
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Seyahat tutkunuzdan ve keşif rotalarınızdan kısaca bahsedin..."
              placeholderTextColor={tokens.color.neutral400}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.charCount}>
              {bio.length}/240
            </Text>
          </View>
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
    paddingTop: Platform.OS === "android" ? 14 : 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.neutral100,
    backgroundColor: tokens.color.surface,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.color.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: tokens.color.text,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.color.successStrong,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  saveBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: tokens.color.surface,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.color.neutral100,
  },
  avatarWrap: {
    position: "relative",
    marginBottom: 10,
  },
  avatarImage: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    borderColor: tokens.color.successStrong,
  },
  avatarCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: tokens.color.surfaceBrand,
    borderWidth: 3,
    borderColor: tokens.color.successStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 34,
    fontWeight: "900",
    color: tokens.color.onSurfaceBrand,
  },
  avatarBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.color.successStrong,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: tokens.color.neutral0,
  },
  avatarSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.color.text,
    marginTop: 2,
  },
  photoActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    marginBottom: 8,
  },
  pickPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.color.successStrong,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: tokens.color.successStrong,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  pickPhotoBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  removePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tokens.color.dangerBg,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  removePhotoBtnText: {
    color: tokens.color.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  avatarTip: {
    fontSize: 11.5,
    color: tokens.color.textSubtle,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  presetScroll: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 6,
  },
  presetItem: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
    position: "relative",
  },
  presetItemSelected: {
    borderColor: tokens.color.successStrong,
    transform: [{ scale: 1.06 }],
  },
  presetImg: {
    width: "100%",
    height: "100%",
  },
  presetCheckOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: withAlpha(tokens.color.successStrong, 0.65),
    alignItems: "center",
    justifyContent: "center",
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.color.onSurfaceBrand,
    letterSpacing: 0.6,
    marginBottom: 7,
  },
  input: {
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: tokens.color.text,
  },
  inputWithPrefix: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  inputPrefix: {
    fontSize: 15,
    fontWeight: "800",
    color: tokens.color.successStrong,
    marginRight: 4,
  },
  inputNoBorder: {
    flex: 1,
    borderWidth: 0,
    paddingLeft: 6,
  },
  textArea: {
    minHeight: 90,
  },
  charCount: {
    fontSize: 11,
    color: tokens.color.neutral400,
    textAlign: "right",
    marginTop: 4,
  },
  suggestionChipsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  sugChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: tokens.color.surfaceSunken,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  sugChipActive: {
    backgroundColor: tokens.color.surfaceBrand,
    borderColor: tokens.color.successStrong,
  },
  sugChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: tokens.color.textMuted,
  },
  sugChipTextActive: {
    color: tokens.color.successStrong,
    fontWeight: "700",
  },
});
