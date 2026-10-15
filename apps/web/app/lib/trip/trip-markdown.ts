import type { Trip, Pin } from "./models";
import { DEFAULT_CATEGORY_META } from "./models";

/**
 * Converts a Trip object into a clean, human-readable, and AI-groundable Markdown document.
 */
export function tripToMarkdown(trip: Trip): string {
  const lines: string[] = [];

  lines.push(`# Seyahat Rotası: ${trip.title || "İsimsiz Seyahat"}`);
  lines.push("");
  lines.push(`- **Destinasyon:** ${trip.destination || "Belirtilmedi"}`);
  lines.push(
    `- **Ulaşım Tercihi:** ${trip.transportMode === "walking" ? "Yürüyüş 🚶" : trip.transportMode === "driving" ? "Araç / Taksi 🚗" : "Toplu Taşıma 🚇"}`,
  );
  lines.push(`- **Toplam Gün Sayısı:** ${trip.days?.length || 1} Gün`);
  if (trip.updatedAt) {
    lines.push(
      `- **Son Güncelleme:** ${new Date(trip.updatedAt).toLocaleDateString("tr-TR")} ${new Date(trip.updatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
    );
  }
  lines.push("");

  // Extract hotels / accommodations from all pins
  const allTripPins: Pin[] = [
    ...(trip.pins || []),
    ...(trip.days?.flatMap((d) => d.pins || []) || []),
  ];

  const hotelPins = allTripPins.filter(
    (p) => p.category === "otel" || /otel|hotel|hostel|pansiyon|airbnb|konaklama/i.test(p.label),
  );
  if (hotelPins.length > 0) {
    lines.push("## 🏨 Konaklama & Oteller");
    for (const h of hotelPins) {
      lines.push(
        `- **${h.label}** - ${h.address || "Adres belirtilmedi"} ${h.note ? `*(Not: ${h.note})*` : ""}`,
      );
    }
    lines.push("");
  }

  // Days and stops
  lines.push("## 📅 Günlük Rota ve Duraklar");
  lines.push("");

  if (!trip.days || trip.days.length === 0) {
    lines.push("*Henüz planlanmış gün bulunmuyor.*");
  } else {
    trip.days.forEach((day, idx) => {
      const dayNum = day.dayIndex ?? idx + 1;
      lines.push(`### ${day.label || `${dayNum}. Gün`}${day.subtitle ? ` — ${day.subtitle}` : ""}`);

      const dayPins = day.pins || [];
      if (dayPins.length === 0) {
        lines.push("- *Bu gün için henüz durak eklenmedi.*");
      } else {
        dayPins.forEach((pin, pIdx) => {
          const categoryMeta = DEFAULT_CATEGORY_META[pin.category] || DEFAULT_CATEGORY_META.genel;
          const status = pin.visited ? "✓ (Ziyaret Edildi)" : "○";
          const duration = pin.durationMinutes ? `${pin.durationMinutes} dk` : "60 dk";
          lines.push(
            `${pIdx + 1}. ${categoryMeta.emoji} **${pin.label}** [${categoryMeta.label}] — ${status}`,
          );
          if (pin.address && pin.address !== pin.label) {
            lines.push(`   - Adres: ${pin.address}`);
          }
          if (pin.note) {
            lines.push(`   - Gezgin Notu: ${pin.note}`);
          }
          lines.push(`   - Planlanan Süre: ${duration}`);
        });
      }
      lines.push("");
    });
  }

  // General unassigned pool pins
  if (trip.pins && trip.pins.length > 0) {
    lines.push("## 📌 Henüz Güne Atanmamış Havuz Durakları");
    trip.pins.forEach((pin) => {
      const meta = DEFAULT_CATEGORY_META[pin.category] || DEFAULT_CATEGORY_META.genel;
      lines.push(
        `- ${meta.emoji} **${pin.label}**: ${pin.address || ""} ${pin.note ? `(${pin.note})` : ""}`,
      );
    });
    lines.push("");
  }

  lines.push("---");
  lines.push(
    "*Bu seyahat manifestosu MapsBridge akıllı harita ve AI asistanı tarafından otomatik olarak güncellenmektedir.*",
  );

  return lines.join("\n");
}

/**
 * Stores the markdown manifest for a trip in localStorage.
 */
export function saveTripMarkdown(tripId: string, markdown: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`mapsbridge.trip.manifesto.${tripId}`, markdown);
  } catch {}
}

/**
 * Retrieves the stored markdown manifest for a trip, or converts the trip if not cached.
 */
export function getTripMarkdown(trip: Trip): string {
  if (typeof window === "undefined") return tripToMarkdown(trip);
  try {
    const cached = localStorage.getItem(`mapsbridge.trip.manifesto.${trip.id}`);
    if (cached) return cached;
  } catch {}
  const md = tripToMarkdown(trip);
  saveTripMarkdown(trip.id, md);
  return md;
}
