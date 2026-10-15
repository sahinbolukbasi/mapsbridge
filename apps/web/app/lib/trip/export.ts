/**
 * §11.10 Plan export
 *
 * Transforms a StructuredTripPlan into shareable formats:
 *   - ShareableExport (canonical interchange)
 *   - ICS (iCalendar — for calendar apps)
 *   - Markdown (human-readable text share)
 *   - Travel Wallet (compact reservation/address card)
 */

import type { StructuredTripPlan } from "../ai/types";

export interface ShareableExport {
  title: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  days: {
    dayIndex: number;
    label: string;
    stops: {
      name: string;
      address?: string;
      startTime?: string;
      duration?: string;
      notes?: string;
      reservationCode?: string;
    }[];
    notes?: string;
  }[];
  reservations: {
    placeName: string;
    code?: string;
    url?: string;
    cancellationDeadline?: string;
  }[];
  exportedAt: string;
  shareUrl?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseTimeRange(time: string): { start: string; end: string } | null {
  const m = time.trim().match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/);
  if (!m) return null;
  return { start: m[1], end: m[2] };
}

function isoDateFromDayString(dateStr: string): string {
  // Accept "YYYY-MM-DD", "GünX", "Day X", "Gün 1" style labels
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return dateStr; // Return as-is; ICS will omit DTSTART if not valid ISO
}

/** Format ISO datetime for ICS: YYYYMMDDTHHmmss */
function icsDate(isoDate: string, timeStr?: string): string {
  const d = isoDate.replace(/-/g, "");
  if (!timeStr) return `${d}T000000`;
  const t = timeStr.replace(/:/g, "").padEnd(6, "0");
  return `${d}T${t}`;
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}@mapsbridge`;
}

// ── buildShareableExport ──────────────────────────────────────────────────────

export function buildShareableExport(
  plan: StructuredTripPlan,
  notes?: Record<string, string>,
): ShareableExport {
  const reservations: ShareableExport["reservations"] = [];

  const days: ShareableExport["days"] = plan.days.map((day, idx) => {
    const stops: ShareableExport["days"][0]["stops"] = [];

    for (const block of day.blocks || []) {
      if (block.type === "transit") continue;

      const timeRange = parseTimeRange(block.time);
      const stopNote = notes?.[block.place_id] ?? block.why;

      stops.push({
        name: block.name,
        startTime: timeRange?.start,
        notes: stopNote,
      });

      // Treat hotel/activity blocks with an alt as having a reservation code
      if (block.type === "hotel" || block.type === "activity") {
        if (block.alt) {
          reservations.push({
            placeName: block.name,
            code: block.alt, // repurpose alt field as reservation code hint
          });
        }
      }
    }

    const dayLabel = `Gün ${idx + 1}${day.date ? ` — ${day.date}` : ""}`;

    return {
      dayIndex: idx + 1,
      label: dayLabel,
      stops,
      notes: day.weather_note || undefined,
    };
  });

  const dates = plan.days.map((d) => d.date).filter(Boolean);

  return {
    title: `Seyahat Planı — ${plan.trip_id}`,
    destination: plan.trip_id, // Caller should override if destination is known separately
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    days,
    reservations,
    exportedAt: new Date().toISOString(),
  };
}

// ── exportToICS ───────────────────────────────────────────────────────────────

export function exportToICS(plan: ShareableExport): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MapsBridge//Travel Plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(plan.title)}`,
    `X-WR-CALDESC:${escapeIcs(plan.destination)}`,
  ];

  for (const day of plan.days) {
    for (const stop of day.stops) {
      const dtBase =
        plan.startDate && /^\d{4}-\d{2}-\d{2}$/.test(plan.startDate)
          ? isoDateFromDayString(plan.startDate)
          : "20250101"; // fallback

      // Advance date by (dayIndex - 1) days
      const baseMs = new Date(dtBase).getTime();
      const dayMs = baseMs + (day.dayIndex - 1) * 86400000;
      const dayStr = new Date(dayMs).toISOString().slice(0, 10);

      const dtStart = icsDate(dayStr, stop.startTime);
      const dtEnd = icsDate(dayStr, stop.startTime); // single-point event; duration not parsed

      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid()}`,
        `DTSTAMP:${icsDate(new Date().toISOString().slice(0, 10))}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${escapeIcs(stop.name)}`,
        ...(stop.address ? [`LOCATION:${escapeIcs(stop.address)}`] : []),
        ...(stop.notes ? [`DESCRIPTION:${escapeIcs(stop.notes)}`] : []),
        "END:VEVENT",
      );
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// ── exportToMarkdown ──────────────────────────────────────────────────────────

export function exportToMarkdown(plan: ShareableExport): string {
  const md: string[] = [];

  md.push(`# ${plan.title}`);
  md.push(`**Destinasyon:** ${plan.destination}`);

  if (plan.startDate || plan.endDate) {
    md.push(`**Tarihler:** ${plan.startDate ?? "?"} – ${plan.endDate ?? "?"}`);
  }

  md.push(`*Dışa aktarım: ${new Date(plan.exportedAt).toLocaleString("tr-TR")}*`);
  md.push("");

  for (const day of plan.days) {
    md.push(`## ${day.label}`);

    if (day.notes) {
      md.push(`> ${day.notes}`);
    }

    for (let i = 0; i < day.stops.length; i++) {
      const stop = day.stops[i];
      const timePrefix = stop.startTime ? `**${stop.startTime}**` : `${i + 1}.`;
      let line = `${timePrefix} ${stop.name}`;
      if (stop.address) line += ` — ${stop.address}`;
      md.push(line);

      if (stop.notes) {
        md.push(`   *${stop.notes}*`);
      }

      if (stop.reservationCode) {
        md.push(`   Rezervasyon: \`${stop.reservationCode}\``);
      }
    }

    md.push("");
  }

  if (plan.reservations.length > 0) {
    md.push("## Rezervasyonlar");

    for (const r of plan.reservations) {
      let line = `- **${r.placeName}**`;
      if (r.code) line += ` | Kod: \`${r.code}\``;
      if (r.url) line += ` | [Bağlantı](${r.url})`;
      if (r.cancellationDeadline) line += ` | İptal: ${r.cancellationDeadline}`;
      md.push(line);
    }
  }

  if (plan.shareUrl) {
    md.push("");
    md.push(`🔗 [Planı görüntüle](${plan.shareUrl})`);
  }

  return md.join("\n");
}

// ── buildTravelWallet ─────────────────────────────────────────────────────────

/**
 * Generates a compact "travel wallet" string — all reservations, addresses,
 * and key contacts on one page for quick offline reference.
 */
export function buildTravelWallet(plan: ShareableExport): string {
  const wallet: string[] = [];

  wallet.push(`=== SEYAHAT CÜZDANI ===`);
  wallet.push(`${plan.title}`);
  if (plan.startDate) wallet.push(`${plan.startDate} – ${plan.endDate ?? "?"}`);
  wallet.push("");

  if (plan.reservations.length > 0) {
    wallet.push("--- REZERVASYONLAR ---");
    for (const r of plan.reservations) {
      const parts = [r.placeName];
      if (r.code) parts.push(`Kod: ${r.code}`);
      if (r.url) parts.push(`URL: ${r.url}`);
      if (r.cancellationDeadline) parts.push(`İptal: ${r.cancellationDeadline}`);
      wallet.push(parts.join(" | "));
    }
    wallet.push("");
  }

  wallet.push("--- ADRESLER ---");
  for (const day of plan.days) {
    for (const stop of day.stops) {
      if (stop.address) {
        wallet.push(`${stop.name}: ${stop.address}`);
      }
    }
  }

  wallet.push("");
  wallet.push(`Dışa aktarım: ${plan.exportedAt}`);

  return wallet.join("\n");
}
