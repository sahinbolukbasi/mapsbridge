export interface KnowledgeBaseMetadata {
  sehir: string;
  kategori: "cafe" | "food" | "lodging" | "parks_sports" | "transit" | "culture" | "emergency";
  mahalle?: string;
  fiyat_seviyesi?: "$" | "$$" | "$$$" | "$$$$" | "ucretsiz" | "belirsiz";
  kaynak: string;
  son_dogrulama_tarihi: string;
}

export function isDocumentStale(
  sonDogrulamaTarihi: string,
  maxAgeDays = 180,
  referenceDate = new Date(),
): boolean {
  const verifiedDate = new Date(sonDogrulamaTarihi);
  if (isNaN(verifiedDate.getTime())) return true;
  const diffTime = referenceDate.getTime() - verifiedDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays > maxAgeDays;
}

export function validateKBMeta(meta: unknown): meta is KnowledgeBaseMetadata {
  if (!meta || typeof meta !== "object") return false;
  const m = meta as Record<string, any>;
  const validCategories = [
    "cafe",
    "food",
    "lodging",
    "parks_sports",
    "transit",
    "culture",
    "emergency",
  ];
  return (
    typeof m.sehir === "string" &&
    m.sehir.trim().length > 0 &&
    typeof m.kategori === "string" &&
    validCategories.includes(m.kategori) &&
    typeof m.kaynak === "string" &&
    m.kaynak.startsWith("https://") &&
    typeof m.son_dogrulama_tarihi === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(m.son_dogrulama_tarihi)
  );
}

export function filterDocumentsByMetadata(
  documents: Array<{ metadata?: KnowledgeBaseMetadata; text: string; [key: string]: any }>,
  filters: { sehir?: string; kategori?: string; mahalle?: string; excludeStale?: boolean },
): Array<{ metadata?: KnowledgeBaseMetadata; text: string; [key: string]: any }> {
  return documents.filter((doc) => {
    if (!doc.metadata) return false;

    if (filters.excludeStale !== false && isDocumentStale(doc.metadata.son_dogrulama_tarihi)) {
      return false;
    }

    if (filters.sehir) {
      if (doc.metadata.sehir.toLowerCase() !== filters.sehir.toLowerCase()) return false;
    }

    if (filters.kategori) {
      if (doc.metadata.kategori !== filters.kategori) return false;
    }

    if (filters.mahalle && doc.metadata.mahalle) {
      if (!doc.metadata.mahalle.toLowerCase().includes(filters.mahalle.toLowerCase())) return false;
    }

    return true;
  });
}

export function buildBedrockRetrievalFilter(filters: {
  sehir?: string;
  kategori?: string;
}): Record<string, any> | undefined {
  const conditions: Array<Record<string, any>> = [];

  if (filters.sehir) {
    conditions.push({
      equals: {
        key: "sehir",
        value: filters.sehir,
      },
    });
  }

  if (filters.kategori) {
    conditions.push({
      equals: {
        key: "kategori",
        value: filters.kategori,
      },
    });
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { andAll: conditions };
}
