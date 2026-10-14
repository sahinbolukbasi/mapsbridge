import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { CloseIcon, CheckIcon, TrashIcon, TagIcon, MapPinIcon } from './Icons';
import { socialSyncService, MobileCommunityPost } from '../services/socialSync';

interface EditPostModalProps {
  visible: boolean;
  post: MobileCommunityPost | null;
  onClose: () => void;
  onSaved: (updatedPost: MobileCommunityPost) => void;
  onDeleted: (postId: string) => void;
}

export function EditPostModal({
  visible,
  post,
  onClose,
  onSaved,
  onDeleted,
}: EditPostModalProps) {
  if (!post) return null;

  const [content, setContent] = useState(post.content);
  const [locationTag, setLocationTag] = useState(post.locationTag || '');
  const [hashtagsText, setHashtagsText] = useState((post.hashtags || []).join(' '));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Eksik İçerik', 'Paylaşım metni boş bırakılamaz.');
      return;
    }

    setSaving(true);
    try {
      const parsedTags = hashtagsText
        .split(' ')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => (t.startsWith('#') ? t : `#${t}`));

      const updated = await socialSyncService.editPost(post.id, {
        content: content.trim(),
        locationTag: locationTag.trim() || undefined,
        hashtags: parsedTags.length > 0 ? parsedTags : ['#Keşif'],
      });

      if (updated) {
        onSaved(updated);
        onClose();
      }
    } catch {
      Alert.alert('Hata', 'Gönderi güncellenirken bir sorun oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Gönderiyi Sil',
      'Bu gezi paylaşımınızı kalıcı olarak silmek istediğinize emin misiniz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await socialSyncService.deletePost(post.id);
            onDeleted(post.id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {/* Top Bar */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.iconBtn} onPress={onClose} activeOpacity={0.7}>
              <CloseIcon size={20} color="#013628" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Gönderiyi Düzenle</Text>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <CheckIcon size={16} color="#ffffff" />
              <Text style={styles.saveBtnText}>{saving ? '...' : 'Güncelle'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Main content input */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>GÖNDERİ METNİ</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={content}
                onChangeText={setContent}
                placeholder="Seyahat deneyiminizi veya rota ipuçlarınızı yazın..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            {/* Location Tag */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>KONUM ETİKETİ</Text>
              <View style={styles.inputWithIcon}>
                <MapPinIcon size={16} color="#10B981" />
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0, paddingLeft: 6 }]}
                  value={locationTag}
                  onChangeText={setLocationTag}
                  placeholder="Örn: Roma, İtalya"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            {/* Hashtags */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>ETİKETLER (BOŞLUKLA AYIRIN)</Text>
              <View style={styles.inputWithIcon}>
                <TagIcon size={16} color="#10B981" />
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0, paddingLeft: 6 }]}
                  value={hashtagsText}
                  onChangeText={setHashtagsText}
                  placeholder="#Doğa #Yürüyüş #Keşif"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            {/* Delete button */}
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
              <TrashIcon size={16} color="#ba1a1a" />
              <Text style={styles.deleteBtnText}>Bu Gönderiyi Sil</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#faf8ff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eaedff',
    backgroundColor: '#ffffff',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f2f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#013628',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
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
    fontWeight: '800',
    color: '#286954',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eaedff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#013628',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eaedff',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  textArea: {
    minHeight: 120,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffdad6',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  deleteBtnText: {
    color: '#ba1a1a',
    fontSize: 14,
    fontWeight: '800',
  },
});
