import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  documentStore,
  type TravelDocument,
  type DocumentCategory,
} from "../services/documentStore";
import {
  Button,
  Card,
  Chip,
  ChipGroup,
  EmptyState,
  Icon,
  IconButton,
  ModalFrame,
  SegmentedControl,
  TextField,
  Txt,
  useToast,
} from "../ui";
import { tokens } from "../theme";

interface DocumentManagerModalProps {
  visible: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<DocumentCategory, { label: string; icon: any }> = {
  flight: { label: "Uçak Bileti", icon: "transit" },
  hotel: { label: "Otel Rezervasyonu", icon: "home" },
  visa: { label: "Vize Evrakı", icon: "shield" },
  ticket: { label: "Etkinlik Bileti", icon: "landmark" },
  insurance: { label: "Sigorta", icon: "check" },
  other: { label: "Diğer Belge", icon: "bag" },
};

export function DocumentManagerModal({ visible, onClose }: DocumentManagerModalProps) {
  const toast = useToast();
  const [docs, setDocs] = useState<TravelDocument[]>([]);
  const [filter, setFilter] = useState<"all" | DocumentCategory | "used">("all");
  const [addOpen, setAddOpen] = useState(false);

  // New doc form
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("flight");
  const [validDate, setValidDate] = useState("");
  const [notes, setNotes] = useState("");
  const [fileUri, setFileUri] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();

  const load = async () => {
    const list = await documentStore.getDocuments();
    setDocs(list);
  };

  useEffect(() => {
    if (visible) {
      load();
    }
    return documentStore.subscribe(load);
  }, [visible]);

  const pickFile = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!res.canceled && res.assets[0]) {
        setFileUri(res.assets[0].uri);
        setFileName(res.assets[0].fileName || "belge_gorseli.jpg");
      }
    } catch {
      toast.show({ tone: "danger", title: "Dosya Seçilemedi", message: "Fotoğraf erişimi reddedildi." });
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.show({ tone: "danger", title: "Başlık Gerekli", message: "Lütfen belgenin adını yazın." });
      return;
    }
    await documentStore.addDocument({
      title: title.trim(),
      category,
      validDate: validDate.trim() || undefined,
      notes: notes.trim() || undefined,
      fileUri,
      fileName,
      status: "upcoming",
    });
    setAddOpen(false);
    setTitle("");
    setValidDate("");
    setNotes("");
    setFileUri(undefined);
    setFileName(undefined);
    toast.show({ tone: "success", title: "Belge Eklendi", message: "Seyahat belgeniz güvenle kaydedildi." });
  };

  const toggleUsed = async (id: string) => {
    await documentStore.toggleStatus(id);
  };

  const deleteDoc = (id: string, name: string) => {
    Alert.alert("Belgeyi Sil", `"${name}" belgesini silmek istediğinize emin misiniz?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await documentStore.deleteDocument(id);
          toast.show({ tone: "info", message: "Belge silindi." });
        },
      },
    ]);
  };

  const filtered = docs.filter((d) => {
    if (filter === "all") return true;
    if (filter === "used") return d.status === "used";
    return d.category === filter;
  });

  return (
    <ModalFrame
      visible={visible}
      variant="sheet"
      title="Seyahat Belgeleri & Biletler"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Top actions & Filter */}
        <View style={styles.topActions}>
          <Button
            label="Yeni Belge Ekle"
            icon={<Icon name="plus" size={16} />}
            size="sm"
            onPress={() => setAddOpen(true)}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterGroup}>
            <Chip pressed={filter === "all"} onPress={() => setFilter("all")}>
              {`Tümü (${docs.length})`}
            </Chip>
            <Chip pressed={filter === "flight"} onPress={() => setFilter("flight")}>
              Uçak Biletleri
            </Chip>
            <Chip pressed={filter === "hotel"} onPress={() => setFilter("hotel")}>
              Otel Rezervasyonları
            </Chip>
            <Chip pressed={filter === "visa"} onPress={() => setFilter("visa")}>
              Vize Evrakları
            </Chip>
            <Chip pressed={filter === "used"} onPress={() => setFilter("used")}>
              Kullanılanlar
            </Chip>
          </View>
        </ScrollView>

        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {filtered.length === 0 ? (
            <EmptyState
              icon="bag"
              title="Kayıtlı Belge Yok"
              description="Uçak biletlerinizi, otel rezervasyonlarınızı veya vize belgelerinizi buraya ekleyin."
            />
          ) : (
            filtered.map((item) => {
              const cat = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.other;
              const isUsed = item.status === "used";
              return (
                <Card key={item.id} variant="bordered" style={[styles.docCard, isUsed && styles.docCardUsed]}>
                  <View style={styles.docHeader}>
                    <View style={styles.catBadge}>
                      <Icon name={cat.icon} size={20} color={isUsed ? tokens.color.textMuted : tokens.color.brand} />
                      <Txt variant="caption" tone={isUsed ? "muted" : "brand"}>
                        {cat.label}
                      </Txt>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={[styles.statusTag, isUsed ? styles.statusTagUsed : styles.statusTagUpcoming]}
                      onPress={() => toggleUsed(item.id)}
                    >
                      <Icon name={isUsed ? "check" : "clock"} size={16} color={isUsed ? "#16a34a" : "#2563eb"} />
                      <Txt variant="caption" style={[styles.statusTagText, { color: isUsed ? "#16a34a" : "#2563eb" }]}>
                        {isUsed ? "Kullanıldı" : "Yaklaşan"}
                      </Txt>
                    </TouchableOpacity>
                  </View>

                  <Txt variant="heading" header style={[styles.docTitle, isUsed && styles.docTitleUsed]}>
                    {item.title}
                  </Txt>

                  {item.validDate ? (
                    <View style={styles.dateRow}>
                      <Icon name="calendar" size={16} color={tokens.color.textMuted} />
                      <Txt variant="caption" tone="muted">
                        Geçerlilik / Tarih: {item.validDate}
                      </Txt>
                    </View>
                  ) : null}

                  {item.notes ? (
                    <Txt variant="small" tone="muted" numberOfLines={2}>
                      {item.notes}
                    </Txt>
                  ) : null}

                  <View style={styles.docFooter}>
                    {item.fileUri ? (
                      <Button
                        label="Belgeyi Gör"
                        variant="secondary"
                        size="sm"
                        icon={<Icon name="external" size={16} />}
                        onPress={() => Linking.openURL(item.fileUri!)}
                      />
                    ) : (
                      <View />
                    )}
                    <View style={styles.cardActions}>
                      <IconButton
                        icon="trash"
                        label="Sil"
                        color={tokens.color.danger}
                        onPress={() => deleteDoc(item.id, item.title)}
                      />
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Add Document Sub-Modal */}
      <ModalFrame
        visible={addOpen}
        variant="sheet"
        title="Yeni Seyahat Belgesi Ekle"
        onRequestClose={() => setAddOpen(false)}
      >
        <ScrollView contentContainerStyle={styles.addForm} keyboardShouldPersistTaps="handled">
          <TextField
            label="Belge Adı / Başlık *"
            value={title}
            onChangeText={setTitle}
            placeholder="Örn: THY İstanbul - Roma Uçuşu"
          />

          <Txt variant="label" style={{ marginTop: 8 }}>
            Belge Türü
          </Txt>
          <SegmentedControl
            label="Belge Türü"
            options={[
              { value: "flight", label: "Uçak" },
              { value: "hotel", label: "Otel" },
              { value: "visa", label: "Vize" },
              { value: "ticket", label: "Bilet" },
            ]}
            value={category}
            onChange={(v) => setCategory(v as DocumentCategory)}
          />

          <TextField
            label="Kullanım Tarihi / Saati"
            value={validDate}
            onChangeText={setValidDate}
            placeholder="Örn: 2026-10-24"
          />

          <TextField
            label="Notlar (Koltuk, Rezervasyon Kodu vb.)"
            value={notes}
            onChangeText={setNotes}
            placeholder="PNR: X8KJ2P, Koltuk: 14A..."
          />

          <View style={styles.uploadArea}>
            <Button
              label={fileName ? `Dosya: ${fileName}` : "Belge/Bilet Görseli Seç"}
              variant="secondary"
              icon={<Icon name="camera" size={16} />}
              onPress={pickFile}
            />
          </View>

          <Button label="Belgeyi Kaydet" size="lg" onPress={handleSave} style={{ marginTop: 12 }} />
        </ScrollView>
      </ModalFrame>
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: tokens.space["4"],
    gap: tokens.space["2"],
  },
  topActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: tokens.space["1"],
  },
  filterScroll: {
    maxHeight: 44,
    marginBottom: tokens.space["2"],
  },
  filterGroup: {
    gap: tokens.space["2"],
  },
  list: {
    gap: tokens.space["3"],
    paddingBottom: tokens.space["6"],
  },
  docCard: {
    padding: tokens.space["3"],
    gap: tokens.space["2"],
    backgroundColor: tokens.color.surface,
  },
  docCardUsed: {
    opacity: 0.7,
    backgroundColor: tokens.color.surfaceSunken,
  },
  docHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  catBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["1"],
  },
  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
  },
  statusTagUpcoming: {
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  statusTagUsed: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  docTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  docTitleUsed: {
    textDecorationLine: "line-through",
    color: tokens.color.textMuted,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["1"],
  },
  docFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: tokens.space["1"],
    paddingTop: tokens.space["2"],
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
  cardActions: {
    flexDirection: "row",
    gap: tokens.space["1"],
  },
  addForm: {
    padding: tokens.space["4"],
    gap: tokens.space["3"],
  },
  uploadArea: {
    marginTop: tokens.space["2"],
  },
});
