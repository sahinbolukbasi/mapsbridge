import type { UnifiedRoutePlan } from "./types";
import { normalizeText } from "./planning";
export interface RouteEdit {
  operation: "none" | "add" | "remove" | "replace" | "reorder" | "adjust";
  day?: number;
  stopIds: string[];
}

export function routeEdit(value: Record<string, unknown>, request: string, route?: UnifiedRoutePlan): RouteEdit {
  const empty: RouteEdit = { operation: "none", stopIds: [] };
  if (
    !route ||
    !value ||
    !["add", "remove", "replace", "reorder", "adjust"].includes(value.operation)
  )
    return empty;
  const mention = typeof value.dayMention === "string" ? value.dayMention.trim() : "";
  const ordinals = ["birinci", "ikinci", "ucuncu", "dorduncu", "besinci", "altinci", "yedinci"];
  const normalized = normalizeText(mention);
  const ordinal = ordinals.findIndex((word) => normalized.includes(word));
  const numeric = normalized.match(/(?:^|\s)([1-7])\.?\s*gun/u);
  const day = ordinal >= 0 ? ordinal + 1 : numeric ? Number(numeric[1]) : undefined;
  const explicit =
    mention &&
    normalizeText(request).includes(normalized) &&
    day === value.day &&
    day !== undefined &&
    day <= route.estimatedDays;
  const ids = Array.isArray(value.stopIds)
    ? value.stopIds.filter(
        (id: unknown) => typeof id === "string" && route.stops.some((s) => s.id === id),
      )
    : [];
  return {
    operation: value.operation,
    ...(explicit ? { day } : {}),
    stopIds: [...new Set<string>(ids)],
  };
}

/** Validate edit promises after place IDs have been resolved by the server. */
export function validateRouteEdit(
  next: UnifiedRoutePlan,
  previous: UnifiedRoutePlan | undefined,
  edit: RouteEdit,
) {
  if (!previous || edit.operation === "none" || previous.destination !== next.destination) return;
  const byId = new Map(next.stops.map((s) => [s.id, s]));
  if (edit.day && next.estimatedDays !== previous.estimatedDays)
    throw Error("Tek gün düzenlemesi toplam gün sayısını değiştiremez.");
  for (const stop of previous.stops) {
    const saved = byId.get(stop.id);
    const untouchedDay = edit.day !== undefined && stop.day !== edit.day;
    const mustKeep =
      untouchedDay ||
      edit.operation === "add" ||
      edit.operation === "reorder" ||
      (edit.operation === "remove" && edit.stopIds.length > 0 && !edit.stopIds.includes(stop.id));
    if (mustKeep && (!saved || saved.day !== stop.day))
      throw Error(`Korunması gereken durak değişti: ${stop.name}.`);
  }
  if (
    edit.day &&
    next.stops.some(
      (s) => s.day !== edit.day && !previous.stops.some((p) => p.id === s.id && p.day === s.day),
    )
  )
    throw Error("İstenen günün dışına yeni durak eklendi.");
  if (
    edit.operation === "add" &&
    !next.stops.some((s) => !previous.stops.some((p) => p.id === s.id))
  )
    throw Error("İstenen yeni durak eklenmedi.");
  if (edit.operation === "remove") {
    if (edit.stopIds.some((id) => byId.has(id)))
      throw Error("Çıkarılması istenen durak hâlâ rotada.");
    if (next.stops.length >= previous.stops.length) throw Error("İstenen durak çıkarılmadı.");
  }
}
