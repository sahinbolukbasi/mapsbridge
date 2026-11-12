import React, { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
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
  ConfirmDialog,
  EmptyState,
  Icon,
  IconButton,
  ModalFrame,
  TextField,
  Txt,
  useToast,
} from "../ui";
import { tokens } from "../theme";

interface DocumentManagerModalProps {
  visible: boolean;
  onClose: () => void;
}

const DEFAULT_CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
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
  const [customCats, setCustomCats] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  // New category popup state
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // In-app preview modal state
  const [previewDoc, setPreviewDoc] = useState<TravelDocument | null>(null);

  // Delete confirm dialog
  const [deleteTarget, setDeleteTarget] = useState<TravelDocument | null>(null);

  // New doc form
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("flight");
  const [customCategory, setCustomCategory] = useState<string>("");
  const [validDate, setValidDate] = useState("");
  const [notes, setNotes] = useState("");
  const [fileUri, setFileUri] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();

  const load = async () => {
    const list = await documentStore.getDocuments();
    const cats = await documentStore.getCustomCategories();
    setDocs(list);
    setCustomCats(cats);
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
        quality: 0.85,
      });
      if (!res.canceled && res.assets[0]) {
        setFileUri(res.assets[0].uri);
        setFileName(res.assets[0].fileName || "belge_gorseli.jpg");
      }
    } catch {
      toast.show({
        tone: "danger",
        title: "Dosya Seçilemedi",
        message: "Fotoğraf kütüphanesine erişim izni gereklidir.",
      });
    }
  };

  const handleCreateCustomCategory = async () => {
    const clean = newCatName.trim();
    if (!clean) {
      toast.show({ tone: "warning", message: "Lütfen bir tür adı girin." });
      return;
    }
    await documentStore.addCustomCategory(clean);
    setCategory("other");
    setCustomCategory(clean);
    setNewCatName("");
    setNewCatModalOpen(false);
    toast.show({ tone: "success", message: `"${clean}" türü eklendi.` });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.show({ tone: "danger", title: "Başlık Gerekli", message: "Lütfen belgenin adını yazın." });
      return;
    }
    await documentStore.addDocument({
      title: title.trim(),
      category,
      customCategory: category === "other" && customCategory ? customCategory : undefined,
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
    setCustomCategory("");
    setFileUri(undefined);
    setFileName(undefined);
    toast.show({ tone: "success", title: "Belge Eklendi", message: "Seyahat belgeniz güvenle cihazda saklandı." });
  };

  const toggleUsed = async (id: string) => {
    await documentStore.toggleStatus(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await documentStore.deleteDocument(deleteTarget.id);
    setDeleteTarget(null);
    toast.show({ tone: "info", message: "Belge cihazdan silindi." });
  };

  // Filter & Search logic
  const filtered = docs.filter((d) => {
    // Search query check
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = d.title.toLowerCase().includes(q);
      const matchNotes = d.notes?.toLowerCase().includes(q);
      const matchCat = (d.customCategory || d.category).toLowerCase().includes(q);
      if (!matchTitle && !matchNotes && !matchCat) return false;
    }

    if (filter === "all") return true;
    if (filter === "used") return d.status === "used";
    if (filter.startsWith("custom_")) {
      const catName = filter.replace("custom_", "");
      return d.customCategory === catName;
    }
    return d.category === filter;
  });

  const getCategoryInfo = (item: TravelDocument) => {
    if (item.customCategory) {
      return { label: item.customCategory, icon: "bag" };
    }
    return DEFAULT_CATEGORY_LABELS[item.category] || DEFAULT_CATEGORY_LABELS.other;
  };

  return (
    <ModalFrame
      visible={visible}
      variant="sheet"
      title="Seyahat Belgeleri & Biletler"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Top actions & Search Bar */}
        <View style={styles.topBar}>
          <View style={styles.searchWrapper}>
            <TextField
              label="Belgelerde Ara"
              placeholder="Başlık, bilet, not ara..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <Button
            label="Belge Ekle"
            icon={<Icon name="plus" size={16} />}
            size="sm"
            onPress={() => setAddOpen(true)}
          />
        </View>

        {/* Sağa - Sola Kaydırılabilir Kategori Filtre Çubuğu */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
          style={styles.filterScroll}
        >
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
          <Chip pressed={filter === "ticket"} onPress={() => setFilter("ticket")}>
            Etkinlikler
          </Chip>
          <Chip pressed={filter === "used"} onPress={() => setFilter("used")}>
            Kullanılanlar
          </Chip>
          {customCats.map((cat) => (
            <Chip
              key={cat}
              pressed={filter === `custom_${cat}`}
              onPress={() => setFilter(`custom_${cat}`)}
            >
              {cat}
            </Chip>
          ))}
        </ScrollView>

        {/* Belge Listesi */}
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {filtered.length === 0 ? (
            <EmptyState
              icon="bag"
              title={searchQuery ? "Aramaya Uygun Belge Bulunamadı" : "Kayıtlı Belge Yok"}
              description={
                searchQuery
                  ? "Farklı bir arama terimi deneyin ya da yeni bir belge ekleyin."
                  : "Uçak biletlerinizi, otel rezervasyonlarınızı veya vize belgelerinizi buraya ekleyin."
              }
            />
          ) : (
            filtered.map((item) => {
              const cat = getCategoryInfo(item);
              const isUsed = item.status === "used";
              return (
                <Card
                  key={item.id}
                  variant="bordered"
                  style={[styles.docCard, isUsed && styles.docCardUsed]}
                >
                  <View style={styles.docHeader}>
                    <View style={styles.catBadge}>
                      <Icon
                        name={cat.icon as any}
                        size={16}
                        color={isUsed ? tokens.color.textMuted : tokens.color.brand}
                      />
                      <Txt variant="caption" tone={isUsed ? "muted" : "brand"}>
                        {cat.label}
                      </Txt>
                    </View>
                    <Pressable
                      style={[
                        styles.statusTag,
                        isUsed ? styles.statusTagUsed : styles.statusTagUpcoming,
                      ]}
                      onPress={() => toggleUsed(item.id)}
                    >
                      <Icon
                        name={isUsed ? "check" : "clock"}
                        size={16}
                        color={isUsed ? tokens.color.success : tokens.color.primary}
                      />
                      <Txt
                        variant="caption"
                        style={[
                          styles.statusTagText,
                          { color: isUsed ? tokens.color.success : tokens.color.primary },
                        ]}
                      >
                        {isUsed ? "Kullanıldı" : "Yaklaşan"}
                      </Txt>
                    </Pressable>
                  </View>

                  <Txt
                    variant="heading"
                    header
                    style={[styles.docTitle, isUsed && styles.docTitleUsed]}
                  >
                    {item.title}
                  </Txt>

                  {item.validDate ? (
                    <View style={styles.dateRow}>
                      <Icon name="calendar" size={16} color={tokens.color.textMuted} />
                      <Txt variant="caption" tone="muted">
                        Tarih / Geçerlilik: {item.validDate}
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
                        label="Uygulama İçinde Gör"
                        variant="secondary"
                        size="sm"
                        icon={<Icon name="sparkle" size={16} />}
                        onPress={() => setPreviewDoc(item)}
                      />
                    ) : (
                      <View />
                    )}
                    <View style={styles.cardActions}>
                      <IconButton
                        icon="trash"
                        label="Sil"
                        color={tokens.color.danger}
                        onPress={() => setDeleteTarget(item)}
                      />
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Yeni Belge Ekleme Modalı */}
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

          <Txt variant="label" style={{ marginTop: 6 }}>
            Belge Türü Seçin
          </Txt>
          {/* Sağa sola kaydırılabilir belge türleri */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeChipsRow}
          >
            <Chip
              pressed={category === "flight" && !customCategory}
              onPress={() => {
                setCategory("flight");
                setCustomCategory("");
              }}
            >
              ✈️ Uçak
            </Chip>
            <Chip
              pressed={category === "hotel" && !customCategory}
              onPress={() => {
                setCategory("hotel");
                setCustomCategory("");
              }}
            >
              🏨 Otel
            </Chip>
            <Chip
              pressed={category === "visa" && !customCategory}
              onPress={() => {
                setCategory("visa");
                setCustomCategory("");
              }}
            >
              🛂 Vize
            </Chip>
            <Chip
              pressed={category === "ticket" && !customCategory}
              onPress={() => {
                setCategory("ticket");
                setCustomCategory("");
              }}
            >
              🎟️ Bilet
            </Chip>
            <Chip
              pressed={category === "insurance" && !customCategory}
              onPress={() => {
                setCategory("insurance");
                setCustomCategory("");
              }}
            >
              🛡️ Sigorta
            </Chip>
            {customCats.map((cat) => (
              <Chip
                key={cat}
                pressed={category === "other" && customCategory === cat}
                onPress={() => {
                  setCategory("other");
                  setCustomCategory(cat);
                }}
              >
                {`🏷️ ${cat}`}
              </Chip>
            ))}
            <Chip
              pressed={false}
              onPress={() => setNewCatModalOpen(true)}
            >
              ➕ Diğer (Yeni Tür Ekle)...
            </Chip>
          </ScrollView>

          {customCategory ? (
            <Txt variant="caption" tone="highlight">
              Seçili Özel Tür: {customCategory}
            </Txt>
          ) : null}

          <TextField
            label="Kullanım Tarihi / Saati"
            value={validDate}
            onChangeText={setValidDate}
            placeholder="Örn: 2026-10-24 14:30"
          />

          <TextField
            label="Notlar (Koltuk, Rezervasyon Kodu vb.)"
            value={notes}
            onChangeText={setNotes}
            placeholder="PNR: X8KJ2P, Koltuk: 14A..."
          />

          <View style={styles.uploadArea}>
            <Button
              label={fileName ? `Cihazdan Seçildi: ${fileName}` : "Belge / Bilet Görseli Seç"}
              variant="secondary"
              icon={<Icon name="camera" size={16} />}
              onPress={pickFile}
            />
            <Txt variant="caption" tone="muted">
              Yüklenen belgeler cihazınızın güvenli yerel depolama alanında saklanır.
            </Txt>
          </View>

          <Button label="Belgeyi Kaydet" size="lg" onPress={handleSave} style={{ marginTop: 12 }} />
        </ScrollView>
      </ModalFrame>

      {/* "Diğer..." deyince açılan Özel Tür Ekleme Pop-up'ı (Uygulamanın kendi ModalFrame tasarımında) */}
      <ModalFrame
        visible={newCatModalOpen}
        variant="sheet"
        title="Yeni Belge Türü Ekle"
        onRequestClose={() => setNewCatModalOpen(false)}
      >
        <View style={styles.newCatModalBody}>
          <Txt variant="body">
            İhtiyacınıza uygun yeni bir seyahat belgesi veya evrak türü adı belirleyin:
          </Txt>
          <TextField
            label="Yeni Tür Adı"
            placeholder="Örn: Feribot Bileti, Konser Girişi, Araç Kiralama..."
            value={newCatName}
            onChangeText={setNewCatName}
          />
          <View style={styles.newCatModalActions}>
            <Button
              label="Türü Ekle & Seç"
              variant="primary"
              size="lg"
              onPress={handleCreateCustomCategory}
            />
            <Button
              label="Vazgeç"
              variant="ghost"
              size="md"
              onPress={() => setNewCatModalOpen(false)}
            />
          </View>
        </View>
      </ModalFrame>

      {/* Uygulama İçi Belge Önizleme Ekranı (In-App Document Viewer) */}
      <ModalFrame
        visible={!!previewDoc}
        variant="fullscreen"
        onRequestClose={() => setPreviewDoc(null)}
      >
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <Txt variant="heading" header numberOfLines={1} style={{ flex: 1 }}>
              {previewDoc?.title}
            </Txt>
            <IconButton icon="x" label="Kapat" onPress={() => setPreviewDoc(null)} />
          </View>

          <View style={styles.previewImageWrapper}>
            {previewDoc?.fileUri ? (
              <Image
                source={{ uri: previewDoc.fileUri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : (
              <EmptyState icon="bag" title="Görsel Bulunamadı" />
            )}
          </View>

          {previewDoc?.notes ? (
            <View style={styles.previewNotesBox}>
              <Txt variant="label">Belge Notları:</Txt>
              <Txt variant="body">{previewDoc.notes}</Txt>
            </View>
          ) : null}
        </View>
      </ModalFrame>

      {/* Uygulamanın Kendi Tasarımında Silme Onay Penceresi */}
      <ConfirmDialog
        visible={!!deleteTarget}
        title="Belgeyi Sil"
        body={`"${deleteTarget?.title}" belgesini cihazdan silmek istediğinize emin misiniz?`}
        confirmLabel="Sil"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: tokens.space["4"],
    gap: tokens.space["2"],
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["2"],
    marginBottom: tokens.space["1"],
  },
  searchWrapper: {
    flex: 1,
  },
  filterScroll: {
    maxHeight: 44,
    marginBottom: tokens.space["2"],
  },
  filterScrollContent: {
    flexDirection: "row",
    gap: tokens.space["2"],
    alignItems: "center",
  },
  typeChipsRow: {
    flexDirection: "row",
    gap: tokens.space["2"],
    alignItems: "center",
    paddingVertical: tokens.space["2"],
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
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surfaceSunken,
  },
  statusTagUsed: {
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surfaceSunken,
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
    gap: tokens.space["1"],
  },
  newCatModalBody: {
    padding: tokens.space["4"],
    gap: tokens.space["4"],
  },
  newCatModalActions: {
    gap: tokens.space["2"],
    marginTop: tokens.space["2"],
  },
  previewContainer: {
    flex: 1,
    backgroundColor: tokens.color.bg,
    padding: tokens.space["4"],
    gap: tokens.space["3"],
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: tokens.space["2"],
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  previewImageWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: tokens.color.surfaceSunken,
    borderRadius: tokens.radius.lg,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewNotesBox: {
    padding: tokens.space["3"],
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.md,
    gap: tokens.space["1"],
  },
});
