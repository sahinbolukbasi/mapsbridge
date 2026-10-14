import { DAY_COLORS, DEFAULT_CATEGORY_META, Pin, PinCategory, Trip } from './models';
import type { UnifiedRoutePlan } from '../ai/types';

export interface WorkspaceData {
  version: 1;
  trips: Trip[];
  generalPins: Pin[];
  activeTripId: string;
  activeDayIndex: number;
  imports: string[];
}
export const WORKSPACE_KEY = 'mapsbridge.workspace.v1';
export const emptyWorkspace = (): WorkspaceData => ({ version: 1, trips: [], generalPins: [], activeTripId: '', activeDayIndex: 0, imports: [] });
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export function validCoordinates(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
export function normalizeCategory(value: string): PinCategory {
  const aliases: Record<string, PinCategory> = { lezzet: 'yemek', gurme: 'gastronomi', cafe: 'kahve', gece: 'eglence', gezi: 'gezilecek' };
  return (value in DEFAULT_CATEGORY_META ? value : aliases[value] || 'genel') as PinCategory;
}
export function normalizeTrip(trip: Trip): Trip {
  const orders = new Map<number, number>();
  const dayIds = new Set(trip.days.map(d => d.dayIndex));
  const pins = [...trip.pins].sort((a, b) => a.order - b.order).map(p => {
    const dayIndex = dayIds.has(p.dayIndex) ? p.dayIndex : 0;
    const order = (orders.get(dayIndex) || 0) + 1;
    orders.set(dayIndex, order);
    return { ...p, tripId: trip.id, dayIndex, order };
  });
  return { ...trip, pins, days: trip.days.map(d => ({ ...d, pins: pins.filter(p => p.dayIndex === d.dayIndex) })), groups: trip.groups.map(g => ({ ...g, pinCount: pins.filter(p => p.group === g.name).length })) };
}
export function parseWorkspace(raw: string | null): WorkspaceData {
  if (!raw) return emptyWorkspace();
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.trips) || !Array.isArray(data.generalPins) || !Array.isArray(data.imports)) throw new Error('Kayıtlı plan okunamadı. Verileriniz korunuyor; yedeğinizi kontrol edin.');
  const ids = new Set<string>();
  const tripIds = new Set<string>();
  for (const t of data.trips) {
    if (!t || typeof t.id !== 'string' || !t.id || tripIds.has(t.id) || typeof t.title !== 'string' || !Array.isArray(t.pins) || !Array.isArray(t.days) || !Array.isArray(t.groups)) throw new Error('Gezi kaydı geçersiz. Mevcut veri değiştirilmedi.');
    tripIds.add(t.id);
    if (new Set(t.days.map((d: any) => d.dayIndex)).size !== t.days.length || t.days.some((d: any) => !Number.isInteger(d.dayIndex) || d.dayIndex < 1)) throw new Error('Gezi günleri geçersiz.');
  }
  for (const p of [...data.generalPins, ...data.trips.flatMap((t: Trip) => t.pins)]) {
    if (!p || typeof p.id !== 'string' || ids.has(p.id) || typeof p.label !== 'string' || typeof p.address !== 'string' || !validCoordinates(p.lat, p.lng)) throw new Error('Konum kaydı geçersiz. Mevcut veri değiştirilmedi.');
    ids.add(p.id);
  }
  return { ...data, trips: data.trips.map(normalizeTrip) };
}
export function moveWorkspacePin(data: WorkspaceData, pinId: string, targetTripId: string | null, dayIndex = 0): WorkspaceData {
  const target = targetTripId ? data.trips.find(t => t.id === targetTripId) : null;
  if (targetTripId && !target) throw new Error('Hedef gezi bulunamadı.');
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || (target && dayIndex !== 0 && !target.days.some(d => d.dayIndex === dayIndex))) throw new Error('Hedef gün bulunamadı.');
  const pin = [...data.generalPins, ...data.trips.flatMap(t => t.pins)].find(p => p.id === pinId);
  if (!pin) throw new Error('Durak bulunamadı.');
  const next = { ...data, generalPins: data.generalPins.filter(p => p.id !== pinId), trips: data.trips.map(t => ({ ...t, pins: t.pins.filter(p => p.id !== pinId) })) };
  if (!target) next.generalPins = [...next.generalPins, { ...pin, tripId: undefined, dayIndex: 0, order: next.generalPins.length + 1, group: 'Genel' }];
  else next.trips = next.trips.map(t => t.id === target.id ? { ...t, pins: [...t.pins, { ...pin, tripId: t.id, dayIndex, order: t.pins.filter(p => p.dayIndex === dayIndex).length + 1, group: t.groups.some(g => g.name === pin.group) ? pin.group : 'Genel' }] } : t);
  return { ...next, trips: next.trips.map(normalizeTrip) };
}
export function removeWorkspaceDay(data: WorkspaceData, tripId: string, dayIndex: number): WorkspaceData {
  return { ...data, trips: data.trips.map(t => t.id !== tripId ? t : normalizeTrip({ ...t, days: t.days.filter(d => d.dayIndex !== dayIndex), pins: t.pins.map(p => p.dayIndex === dayIndex ? { ...p, dayIndex: 0 } : p) })), activeDayIndex: data.activeTripId === tripId && data.activeDayIndex === dayIndex ? 0 : data.activeDayIndex };
}
export function routeToTrip(route: UnifiedRoutePlan, id: string): Trip {
  if (!route.title?.trim() || !Array.isArray(route.stops) || !route.stops.length || route.stops.length > 100 || !Number.isInteger(route.estimatedDays) || route.estimatedDays < 1 || route.estimatedDays > 30) throw new Error('AI planı geçerli günler ve duraklar içermeli.');
  const days = Array.from({ length: route.estimatedDays }, (_, i) => ({ dayIndex: i + 1, label: `${i + 1}. Gün`, color: DAY_COLORS[i % DAY_COLORS.length], startTime: '09:00', pins: [] as Pin[] }));
  const pins: Pin[] = route.stops.map((s, i) => {
    if (!s.name?.trim() || !validCoordinates(s.lat, s.lng) || !Number.isInteger(s.day) || s.day < 1 || s.day > days.length) throw new Error('AI planında geçersiz konum veya gün var. Plan kaydedilmedi.');
    const amount = parseFloat(String(s.suggestedDuration).replace(',', '.'));
    const durationMinutes = Number.isFinite(amount) ? Math.max(5, Math.min(720, Math.round(amount * (/saat|hour/i.test(s.suggestedDuration) ? 60 : 1)))) : 60;
    return { id: `${id}-pin-${i}`, label: s.name, address: s.address || `${s.name}, ${route.destination}`, lat: s.lat, lng: s.lng, category: normalizeCategory(s.category || 'genel'), note: s.description, tripId: id, dayIndex: s.day, order: i + 1, group: 'Genel', visited: false, durationMinutes };
  });
  return normalizeTrip({ id, title: route.title, destination: route.destination, theme: route.theme, transportMode: 'walking', isPublic: false, days, groups: [], pins });
}

export function tripToRoute(trip: Trip): UnifiedRoutePlan {
  const estimatedDays = Math.max(1, trip.days?.length || 1);
  const stops = (trip.pins || [])
    .filter(p => validCoordinates(p.lat, p.lng))
    .sort((a, b) => (a.dayIndex - b.dayIndex) || (a.order - b.order))
    .map((p, idx) => {
      const mins = p.durationMinutes || 60;
      const hours = mins >= 60 ? `${(mins / 60).toFixed(1).replace('.0', '')} saat` : `${mins} dakika`;
      return {
        id: p.id || `stop-${idx + 1}`,
        name: p.label || 'Durak',
        lat: p.lat,
        lng: p.lng,
        day: Math.max(1, Math.min(estimatedDays, p.dayIndex || 1)),
        description: p.note || `${p.label} ziyareti`,
        suggestedDuration: hours,
        category: p.category || 'genel',
        address: p.address || '',
        estimatedMinutes: mins,
      };
    });

  return {
    title: trip.title || 'Seyahat Planı',
    summary: trip.theme ? `${trip.theme} temalı seyahat planı.` : `${trip.title || 'Gezi'} için hazırlanan rota.`,
    theme: trip.theme || 'Gezi',
    destination: trip.destination || 'Şehir',
    estimatedDays,
    stops,
  };
}

export function importRoute(data: WorkspaceData, route: UnifiedRoutePlan, draftId: string): WorkspaceData {

  const id = `ai-${draftId}`;
  if (data.imports.includes(id)) {
    if (!data.trips.some(t => t.id === id)) throw new Error('Bu taslağın gezisi silinmiş. Yeni bir taslak oluşturun.');
    return { ...data, activeTripId: id, activeDayIndex: 1 };
  }
  const trip = routeToTrip(route, id);
  return { ...data, trips: [...data.trips, trip], activeTripId: id, activeDayIndex: 1, imports: [...data.imports, id] };
}
