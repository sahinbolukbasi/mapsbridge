import { File, Paths } from "expo-file-system";
import { storage } from "./storage";

export type DocumentCategory =
  | "flight"
  | "hotel"
  | "visa"
  | "ticket"
  | "insurance"
  | "other"
  | string;

export interface TravelDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  customCategory?: string;
  fileName?: string;
  fileUri?: string;
  validDate?: string; // YYYY-MM-DD or ISO string for chronological sorting
  tags?: string[];
  status: "upcoming" | "used";
  notes?: string;
  createdAt: string;
}

const STORAGE_KEY = "mb_travel_documents";
const CUSTOM_CATEGORIES_KEY = "mb_custom_doc_categories";

/** Seçilen görsel/dosyayı cihazın kalıcı Paths.cache/document klasörüne kopyalar. */
export async function persistDocumentLocally(sourceUri: string, suggestedName?: string): Promise<string> {
  try {
    const ext = sourceUri.split(".").pop() || "jpg";
    const destName = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const targetFile = new File(Paths.cache, destName);
    const sourceFile = new File(sourceUri);
    if (sourceFile.exists) {
      sourceFile.copy(targetFile);
      return targetFile.uri;
    }
    return sourceUri;
  } catch (err) {
    console.warn("[DocumentStore] File copy error, using original URI:", err);
    return sourceUri;
  }
}

class DocumentStore {
  private documents: TravelDocument[] = [];
  private customCategories: string[] = [];
  private listeners = new Set<() => void>();
  private initialized = false;

  private async init() {
    if (this.initialized) return;
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      if (raw) {
        this.documents = JSON.parse(raw);
      }
      const rawCats = await storage.getItem(CUSTOM_CATEGORIES_KEY);
      if (rawCats) {
        this.customCategories = JSON.parse(rawCats);
      }
    } catch {
      this.documents = [];
      this.customCategories = [];
    }
    this.initialized = true;
  }

  private async persist() {
    try {
      await storage.setItem(STORAGE_KEY, JSON.stringify(this.documents));
      await storage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(this.customCategories));
    } catch {}
    this.notify();
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async getDocuments(): Promise<TravelDocument[]> {
    await this.init();
    return [...this.documents].sort((a, b) => {
      // Upcoming first, used last
      if (a.status !== b.status) {
        return a.status === "upcoming" ? -1 : 1;
      }
      // If dates exist, sort chronologically
      if (a.validDate && b.validDate) {
        return a.validDate.localeCompare(b.validDate);
      }
      if (a.validDate) return -1;
      if (b.validDate) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  public async getCustomCategories(): Promise<string[]> {
    await this.init();
    return [...this.customCategories];
  }

  public async addCustomCategory(cat: string): Promise<string> {
    await this.init();
    const clean = cat.trim();
    if (!clean) return "";
    if (!this.customCategories.includes(clean)) {
      this.customCategories.push(clean);
      await this.persist();
    }
    return clean;
  }

  public async addDocument(
    doc: Omit<TravelDocument, "id" | "createdAt" | "status"> & { status?: "upcoming" | "used" },
  ): Promise<TravelDocument> {
    await this.init();
    let persistentUri = doc.fileUri;
    if (doc.fileUri) {
      persistentUri = await persistDocumentLocally(doc.fileUri, doc.fileName);
    }

    const newDoc: TravelDocument = {
      ...doc,
      fileUri: persistentUri,
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      status: doc.status || "upcoming",
      createdAt: new Date().toISOString(),
      tags: doc.tags || [],
    };
    this.documents.unshift(newDoc);
    await this.persist();
    return newDoc;
  }

  public async toggleStatus(id: string): Promise<void> {
    await this.init();
    const target = this.documents.find((d) => d.id === id);
    if (!target) return;
    target.status = target.status === "upcoming" ? "used" : "upcoming";
    await this.persist();
  }

  public async deleteDocument(id: string): Promise<void> {
    await this.init();
    this.documents = this.documents.filter((d) => d.id !== id);
    await this.persist();
  }
}

export const documentStore = new DocumentStore();
