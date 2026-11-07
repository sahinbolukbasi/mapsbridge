import { storage } from "./storage";
import { routeService, RouteEntity, RouteStop } from "./api";
import {
  GUEST_OWNER,
  TRIP_KEYS,
  guestRoutesForTransfer,
  ownerChange,
  type TripOrigin,
} from "./trip-owner";

export interface TripStop {
  id: string;
  name: string;
  category: string;
  time: string;
  duration: string;
  address: string;
  lat: number;
  lng: number;
  visited?: boolean;
  notes?: string;
  photoUrl?: string;
  rating?: number;
  budget?: string;
  openHours?: string;
  walkTimeFromPrev?: string;
  distanceFromPrev?: string;
  /** Yer proxy'sinden eklendiyse sağlayıcı kimliği (ayrıntı ve tekrar önerilmeme için). */
  placeId?: string;
  placeProvider?: "amazon" | "google";
}

export interface ActiveRoute {
  id: string;
  name: string;
  day: number;
  stops: TripStop[];
  /** Oluşturulduğu kimlik: oturumsuzken "guest" (design §6.3). Eski kayıtlarda yoktur. */
  origin?: TripOrigin;
  /** Misafirden aktarıldı, sunucuya henüz yazılamadı (bir sonraki eşitlemede yeniden denenir). */
  pendingUpload?: boolean;
}

export const CURATED_ROUTES: ActiveRoute[] = [];
export const SAVED_POOL_STOPS: TripStop[] = [];

export const EMPTY_ROUTE: ActiveRoute = {
  id: "",
  name: "Yeni Rota",
  day: 1,
  stops: [],
};

function routeEntityToActiveRoute(entity: RouteEntity): ActiveRoute {
  return {
    id: entity.routeId,
    name: entity.name || "İsimsiz Rota",
    day: 1,
    origin: "user",
    stops: (entity.stops || []).map((s, idx) => ({
      id: s.id || `stop-${idx}`,
      name: s.name,
      category: s.category || "MEKAN",
      time: s.timeSlot || "10:00",
      duration: s.duration || "60 dk",
      address: s.address || "",
      lat: s.lat,
      lng: s.lng,
      visited: false,
    })),
  };
}

function tripStopToRouteStop(stop: TripStop): RouteStop {
  return {
    id: stop.id,
    name: stop.name,
    category: stop.category,
    lat: stop.lat,
    lng: stop.lng,
    address: stop.address,
    duration: stop.duration,
    timeSlot: stop.time,
  };
}

interface StoredTrips {
  owner: string | null;
  routes: ActiveRoute[];
  activeRouteId: string;
  savedPool: TripStop[];
}

// Hesap yalıtımı (design §6.3/§6.4, KVKK): cihazdaki kayıt yalnızca sahibine gösterilir. Sahip
// App tarafından `setOwner` ile verilir (oturum açılışı/girişi/çıkışı); o ana dek bellekte gezi
// yoktur ve hiçbir şey yazılmaz. Misafir modunda sunucuya istek atılmaz.
class TripStore {
  private routes: ActiveRoute[] = [];
  private activeRouteId: string = "";
  private savedPool: TripStop[] = [];
  private listeners: Set<() => void> = new Set();
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Şu anki sahip (küçük harf e-posta / "guest"); null = App henüz bildirmedi. */
  private owner: string | null = null;
  /** Diskten okunmuş, sahibi doğrulanmamış kayıt (setOwner'da uygulanır ya da atılır). */
  private stored: StoredTrips | null = null;
  private loaded: Promise<void>;
  private ownerQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.loaded = this.load();
  }

  private async load() {
    const stored: StoredTrips = { owner: null, routes: [], activeRouteId: "", savedPool: [] };
    try {
      stored.owner = await storage.getItem(TRIP_KEYS.owner);
      const storedRoutes = await storage.getItem(TRIP_KEYS.routes);
      if (storedRoutes) stored.routes = JSON.parse(storedRoutes);
      stored.activeRouteId = (await storage.getItem(TRIP_KEYS.activeRouteId)) || "";
      const storedPool = await storage.getItem(TRIP_KEYS.savedPool);
      if (storedPool) stored.savedPool = JSON.parse(storedPool);
    } catch {}
    if (!Array.isArray(stored.routes)) stored.routes = [];
    if (!Array.isArray(stored.savedPool)) stored.savedPool = [];
    this.stored = stored;
  }

  private isMember(): boolean {
    return this.owner !== null && this.owner !== GUEST_OWNER;
  }

  private originNow(): TripOrigin {
    return this.isMember() ? "user" : "guest";
  }

  /**
   * Kimliği bildirir (`ownerFromEmail(session?.email)`). Başka bir hesabın kaydı silinir; misafirden
   * hesaba geçişte yalnızca misafir taslakları aktarılır ve sunucuya yazılır; oturumlu sahipte
   * sunucuyla eşitlenir. Çağrılar sırayla uygulanır.
   */
  public setOwner(next: string): Promise<void> {
    this.ownerQueue = this.ownerQueue
      .then(() => this.applyOwner(next))
      .catch((err) => {
        console.warn("Trip owner change failed:", err);
      });
    return this.ownerQueue;
  }

  /** Çıkışta çağrılır: geziler, yer havuzu, sunucu önbelleği ve sahip işareti silinir. */
  public clearForSignOut(): Promise<void> {
    this.ownerQueue = this.ownerQueue
      .then(async () => {
        await this.loaded;
        this.stored = null;
        this.resetMemory();
        this.owner = GUEST_OWNER;
        await storage.removeItem(TRIP_KEYS.serverCache);
        this.notify();
      })
      .catch((err) => console.warn("Trip store clear failed:", err));
    return this.ownerQueue;
  }

  private resetMemory() {
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = null;
    this.routes = [];
    this.activeRouteId = "";
    this.savedPool = [];
  }

  private async applyOwner(next: string) {
    await this.loaded;
    if (this.owner === next) {
      if (this.isMember()) await this.syncWithServer();
      return;
    }
    const source: StoredTrips = this.stored ?? {
      owner: this.owner,
      routes: this.routes,
      activeRouteId: this.activeRouteId,
      savedPool: this.savedPool,
    };
    this.stored = null;
    const change = ownerChange(source.owner, next);
    this.resetMemory();
    if (change === "clear") {
      await storage.removeItem(TRIP_KEYS.serverCache);
    } else {
      this.routes = change === "transfer" ? guestRoutesForTransfer(source.routes) : source.routes;
      this.savedPool = source.savedPool;
      this.activeRouteId = this.routes.some((r) => r.id === source.activeRouteId)
        ? source.activeRouteId
        : this.routes[0]?.id || "";
    }
    this.owner = next;
    this.notify();
    if (this.isMember()) await this.syncWithServer();
  }

  /** Misafirden aktarılmış taslakları sunucuya yazar (başarısız olan beklemede kalır). */
  private async uploadPending(owner: string) {
    for (const route of this.routes.filter((r) => r.pendingUpload)) {
      try {
        const created = await routeService.createRoute(
          route.name,
          route.stops.map(tripStopToRouteStop),
        );
        if (this.owner !== owner) return;
        if (created?.routeId) {
          if (this.activeRouteId === route.id) this.activeRouteId = created.routeId;
          route.id = created.routeId;
          delete route.pendingUpload;
        }
      } catch (err) {
        console.warn("Guest draft upload error:", err);
      }
    }
  }

  public async syncWithServer(): Promise<void> {
    const owner = this.owner;
    if (!owner || owner === GUEST_OWNER) return;
    try {
      await this.uploadPending(owner);
      if (this.owner !== owner) return;
      const serverRoutes = await routeService.listRoutes();
      // Eşitleme sürerken kimlik değiştiyse sonuç bu sahibe yazılmaz.
      if (this.owner !== owner) return;
      if (Array.isArray(serverRoutes)) {
        // Sunucu kaynak; sunucuya henüz yazılamamış aktarılmış taslaklar korunur.
        const pending = this.routes.filter((r) => r.pendingUpload);
        this.routes = [...serverRoutes.map(routeEntityToActiveRoute), ...pending];
        if (!this.routes.some((r) => r.id === this.activeRouteId)) {
          this.activeRouteId = this.routes[0]?.id || "";
        }
        this.notify();
      }
    } catch (err) {
      console.warn("Failed to sync routes from server:", err);
    }
  }

  public getAllRoutes(): ActiveRoute[] {
    return this.routes;
  }

  public getActiveRoute(): ActiveRoute {
    const found = this.routes.find((r) => r.id === this.activeRouteId);
    return found || this.routes[0] || EMPTY_ROUTE;
  }

  public getSavedPool(): TripStop[] {
    return this.savedPool;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch {}
    });
    this.persist();
  }

  private async persist() {
    // Sahip bilinmeden yazılmaz (diskteki kayıt henüz doğrulanmadı).
    const owner = this.owner;
    if (owner === null) return;
    try {
      await storage.setItem(TRIP_KEYS.routes, JSON.stringify(this.routes));
      await storage.setItem(TRIP_KEYS.activeRouteId, this.activeRouteId);
      await storage.setItem(TRIP_KEYS.savedPool, JSON.stringify(this.savedPool));
      await storage.setItem(TRIP_KEYS.owner, owner);
    } catch {}
  }

  private scheduleServerSync() {
    if (!this.isMember()) return;
    const owner = this.owner;
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      if (this.owner !== owner) return;
      const current = this.getActiveRoute();
      if (current && current.id && !current.pendingUpload) {
        routeService
          .updateRoute(current.id, current.name, current.stops.map(tripStopToRouteStop))
          .catch((err) => console.warn("Background route sync error:", err));
      }
    }, 1200);
  }

  public switchActiveRoute(routeId: string) {
    if (this.routes.some((r) => r.id === routeId)) {
      this.activeRouteId = routeId;
      this.notify();
    }
  }

  public setActiveRoute(route: ActiveRoute) {
    const existingIndex = this.routes.findIndex((r) => r.id === route.id);
    if (existingIndex >= 0) {
      this.routes[existingIndex] = route;
    } else {
      this.routes = [{ ...route, origin: route.origin ?? this.originNow() }, ...this.routes];
    }
    this.activeRouteId = route.id;
    this.notify();
    this.scheduleServerSync();
  }

  public setActiveRouteName(name: string) {
    const current = this.getActiveRoute();
    if (current && current.id) {
      current.name = name;
      this.notify();
      this.scheduleServerSync();
    }
  }

  public createRoute(name: string, stops?: TripStop[]): ActiveRoute {
    const localId = `route-${Date.now()}`;
    const newRoute: ActiveRoute = {
      id: localId,
      name: name.trim() || "Yeni Rota",
      day: 1,
      stops: stops && stops.length > 0 ? stops : [],
      origin: this.originNow(),
    };
    this.routes = [newRoute, ...this.routes];
    this.activeRouteId = newRoute.id;
    this.notify();

    // Misafir taslağı yalnızca cihazda kalır; girişte hesaba aktarılır (design §6.3).
    if (!this.isMember()) return newRoute;
    const owner = this.owner;
    // Async persist to backend API
    routeService
      .createRoute(newRoute.name, newRoute.stops.map(tripStopToRouteStop))
      .then((created) => {
        if (created?.routeId && this.owner === owner) {
          newRoute.id = created.routeId;
          if (this.activeRouteId === localId) {
            this.activeRouteId = created.routeId;
          }
          this.notify();
        }
      })
      .catch((err) => console.warn("Create route server error:", err));

    return newRoute;
  }

  public updateRouteName(routeId: string, name: string) {
    const route = this.routes.find((r) => r.id === routeId);
    if (route) {
      route.name = name.trim() || "İsimsiz Rota";
      this.notify();
      if (route.id && this.isMember() && !route.pendingUpload) {
        routeService
          .updateRoute(route.id, route.name, route.stops.map(tripStopToRouteStop))
          .catch((err) => console.warn("Update route name server error:", err));
      }
    }
  }

  public deleteRoute(routeId: string) {
    this.routes = this.routes.filter((r) => r.id !== routeId);
    if (this.activeRouteId === routeId) {
      this.activeRouteId = this.routes[0]?.id || "";
    }
    this.notify();
    if (routeId && this.isMember()) {
      routeService
        .deleteRoute(routeId)
        .catch((err) => console.warn("Delete route server error:", err));
    }
  }

  public setStops(stops: TripStop[]) {
    const current = this.getActiveRoute();
    if (current && current.id) {
      current.stops = stops;
      this.notify();
      this.scheduleServerSync();
    }
  }

  public addStop(stop: TripStop) {
    const current = this.getActiveRoute();
    if (!current || !current.id) {
      this.createRoute("Yeni Keşif Rotam", [stop]);
      return;
    }
    current.stops = [...current.stops, stop];
    this.notify();
    this.scheduleServerSync();
  }

  public updateStop(stopId: string, updates: Partial<TripStop>) {
    const current = this.getActiveRoute();
    if (current && current.id) {
      current.stops = current.stops.map((s) => (s.id === stopId ? { ...s, ...updates } : s));
      this.notify();
      this.scheduleServerSync();
    }
  }

  public removeStop(id: string) {
    const current = this.getActiveRoute();
    if (current && current.id) {
      current.stops = current.stops.filter((s) => s.id !== id);
      this.notify();
      this.scheduleServerSync();
    }
  }

  public reorderStops(fromIndex: number, toIndex: number) {
    const current = this.getActiveRoute();
    if (
      !current ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= current.stops.length ||
      toIndex >= current.stops.length
    ) {
      return;
    }
    const stops = [...current.stops];
    const [moved] = stops.splice(fromIndex, 1);
    stops.splice(toIndex, 0, moved);
    current.stops = stops;
    this.notify();
    this.scheduleServerSync();
  }

  public toggleVisited(id: string) {
    const current = this.getActiveRoute();
    if (current) {
      current.stops = current.stops.map((s) => (s.id === id ? { ...s, visited: !s.visited } : s));
      this.notify();
    }
  }

  /** Günsüz yer → Kaydedilenler (web planner pool karşılığı). Aynı yer iki kez eklenmez. */
  public addToPool(stop: TripStop): boolean {
    const dup = this.savedPool.some(
      (p) =>
        (stop.placeId && p.placeId === stop.placeId) ||
        (Math.abs(p.lat - stop.lat) < 1e-5 && Math.abs(p.lng - stop.lng) < 1e-5),
    );
    if (dup) return false;
    this.savedPool = [...this.savedPool, stop];
    this.notify();
    return true;
  }

  public removeFromPool(poolId: string) {
    this.savedPool = this.savedPool.filter((p) => p.id !== poolId);
    this.notify();
  }

  /**
   * Kaydedilenler → aktif rota. Zaman/mesafe uydurulmaz (I1/I2): `time` yalnız gün öneki
   * (çok günlü rotada) ya da boş; bağlantı süreleri OSRM'den hesaplanır.
   */
  public addFromPool(poolId: string, time = "") {
    const item = this.savedPool.find((p) => p.id === poolId);
    const current = this.getActiveRoute();
    if (!item || !current || !current.id) return;
    this.savedPool = this.savedPool.filter((p) => p.id !== poolId);
    const { walkTimeFromPrev: _w, distanceFromPrev: _d, ...rest } = item;
    void _w;
    void _d;
    current.stops = [...current.stops, { ...rest, id: `stop-${Date.now()}`, time }];
    this.notify();
    this.scheduleServerSync();
  }

  public clearSavedPool() {
    this.savedPool = [];
    storage.removeItem(TRIP_KEYS.savedPool);
    this.notify();
  }

  public loadRouteFromExternal(name: string, stops: TripStop[]) {
    this.createRoute(name, stops);
  }
}

export const tripStore = new TripStore();
