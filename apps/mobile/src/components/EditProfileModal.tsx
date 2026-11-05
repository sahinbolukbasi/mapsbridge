import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { socialSyncService, type MobileUserProfile } from "../services/socialSync";
import { Avatar, Button, ModalFrame, Notice, TextField } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";

// Profili düzenle (FEAT-012: ModalFrame + primitive'ler; web /profile/edit/ metinleri). Kayıt
// bugünkü socialSyncService.updateUserProfile ile (cihazda). Stok avatar ön ayarları, hazır unvan
// önerileri ve boş alana yazılan uydurma "İstanbul, Türkiye" / "Doğa & Rota Kaşifi" varsayılanları
// kaldırıldı: boş alan boş kalır.
interface EditProfileModalProps {
  visible: boolean;
  profile?: MobileUserProfile | null;
  onClose: () => void;
  onSaved: (updated: MobileUserProfile) => void;
}

export function EditProfileModal({ visible, profile, onClose, onSaved }: EditProfileModalProps) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [travelTitle, setTravelTitle] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setFullName(profile?.fullName ?? "");
    setUsername(profile?.username ?? "");
    setTravelTitle(profile?.travelTitle ?? "");
    setBio(profile?.bio ?? "");
    setLocation(profile?.location ?? "");
    setAvatarUrl(profile?.avatarUrl ?? "");
    setError(null);
  }, [visible, profile]);

  const pickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setError(tr("native.profile.photoPermission"));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.length) setAvatarUrl(result.assets[0].uri);
    } catch {
      setError(tr("ui.unexpectedError"));
    }
  };

  const save = async () => {
    const cleanUsername = username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    if (!fullName.trim()) {
      setError(`${tr("edit.fullName")}: ${tr("ui.required")}`);
      return;
    }
    if (!cleanUsername) {
      setError(tr("edit.username.required"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await socialSyncService.updateUserProfile({
        fullName: fullName.trim(),
        username: cleanUsername,
        travelTitle: travelTitle.trim(),
        bio: bio.trim(),
        location: location.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      });
      onSaved(updated);
      onClose();
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
      title={tr("profile.edit")}
      onRequestClose={onClose}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <View style={styles.photo}>
          <Avatar name={fullName || username || "?"} uri={avatarUrl} size={72} />
          <View style={styles.photoActions}>
            <Button label={tr("profile.photo")} variant="secondary" size="sm" onPress={pickPhoto} />
            {avatarUrl ? (
              <Button
                label={tr("planner.photos.remove")}
                variant="ghost"
                size="sm"
                onPress={() => setAvatarUrl("")}
              />
            ) : null}
          </View>
        </View>
        <TextField
          label={tr("edit.fullName")}
          value={fullName}
          onChangeText={setFullName}
          maxLength={80}
        />
        <TextField
          label={tr("edit.username")}
          hint={tr("edit.username.hint")}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={30}
        />
        <TextField
          label={tr("edit.title")}
          hint={tr("ui.optional")}
          value={travelTitle}
          onChangeText={setTravelTitle}
          maxLength={60}
        />
        <TextField
          label={tr("edit.location")}
          hint={tr("ui.optional")}
          value={location}
          onChangeText={setLocation}
          maxLength={80}
        />
        <TextField
          label={tr("edit.bio")}
          hint={tr("ui.optional")}
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={300}
        />
        <Button label={tr("edit.save")} size="lg" loading={saving} onPress={save} />
      </ScrollView>
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  form: { padding: tokens.space["5"], gap: tokens.space["4"], paddingBottom: tokens.space["12"] },
  photo: { flexDirection: "row", alignItems: "center", gap: tokens.space["4"] },
  photoActions: { gap: tokens.space["2"] },
});
