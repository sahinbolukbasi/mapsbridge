import { storage } from './storage';
import { routeService, RouteEntity, RouteStop } from './api';

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
}

export interface ActiveRoute {
  id: string;
  name: string;
  day: number;
  stops: TripStop[];
}

export const CURATED_ROUTES: ActiveRoute[] = [];
export const SAVED_POOL_STOPS: TripStop[] = [];

export const EMPTY_ROUTE: ActiveRoute = {
  id: '',
  name: 'Yeni Rota',
  day: 1,
  stops: [],
};

function routeEntityToActiveRoute(entity: RouteEntity): ActiveRoute {
  return {
    id: entity.routeId,
    name: entity.name || 'İsimsiz Rota',
    day: 1,
    stops: (entity.stops || []).map((s, idx) => ({
      id: s.id || `stop-${idx}`,
      name: s.name,
      category: s.category || 'MEKAN',
      time: s.timeSlot || '10:00',
      duration: s.duration || '60 dk',
      address: s.address || '',
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

class TripStore {
  private routes: ActiveRoute[] = [];
  private activeRouteId: string = '';
  private savedPool: TripStop[] = [];
  private listeners: Set<() => void> = new Set();
  private syncTimeout: any = null;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const storedRoutes = await storage.getItem('mb_all_routes');
      if (storedRoutes) {
        this.routes = JSON.parse(storedRoutes);
      }
      const storedActiveId = await storage.getItem('mb_active_route_id');
      if (storedActiveId && this.routes.some((r) => r.id === storedActiveId)) {
        this.activeRouteId = storedActiveId;
      } else if (this.routes.length > 0) {
        this.activeRouteId = this.routes[0].id;
      }
      const storedPool = await storage.getItem('mb_saved_pool');
      if (storedPool) {
        this.savedPool = JSON.parse(storedPool);
      }
    } catch {}

    // Pull real routes from backend server
    this.syncWithServer();
  }

  public async syncWithServer(): Promise<void> {
    try {
      const serverRoutes = await routeService.listRoutes();
      if (Array.isArray(serverRoutes)) {
        if (serverRoutes.length > 0) {
          this.routes = serverRoutes.map(routeEntityToActiveRoute);
          if (!this.routes.some((r) => r.id === this.activeRouteId)) {
            this.activeRouteId = this.routes[0]?.id || '';
          }
        } else {
          // Clean empty state if user has no server routes
          this.routes = [];
          this.activeRouteId = '';
        }
        this.notify();
      }
    } catch (err) {
      console.warn('Failed to sync routes from server:', err);
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
    try {
      await storage.setItem('mb_all_routes', JSON.stringify(this.routes));
      await storage.setItem('mb_active_route_id', this.activeRouteId);
      await storage.setItem('mb_saved_pool', JSON.stringify(this.savedPool));
    } catch {}
  }

  private scheduleServerSync() {
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      const current = this.getActiveRoute();
      if (current && current.id) {
        routeService
          .updateRoute(current.id, current.name, current.stops.map(tripStopToRouteStop))
          .catch((err) => console.warn('Background route sync error:', err));
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
      this.routes = [route, ...this.routes];
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
      name: name.trim() || 'Yeni Rota',
      day: 1,
      stops: stops && stops.length > 0 ? stops : [],
    };
    this.routes = [newRoute, ...this.routes];
    this.activeRouteId = newRoute.id;
    this.notify();

    // Async persist to backend API
    routeService
      .createRoute(newRoute.name, newRoute.stops.map(tripStopToRouteStop))
      .then((created) => {
        if (created?.routeId) {
          newRoute.id = created.routeId;
          if (this.activeRouteId === localId) {
            this.activeRouteId = created.routeId;
          }
          this.notify();
        }
      })
      .catch((err) => console.warn('Create route server error:', err));

    return newRoute;
  }

  public updateRouteName(routeId: string, name: string) {
    const route = this.routes.find((r) => r.id === routeId);
    if (route) {
      route.name = name.trim() || 'İsimsiz Rota';
      this.notify();
      if (route.id) {
        routeService
          .updateRoute(route.id, route.name, route.stops.map(tripStopToRouteStop))
          .catch((err) => console.warn('Update route name server error:', err));
      }
    }
  }

  public deleteRoute(routeId: string) {
    this.routes = this.routes.filter((r) => r.id !== routeId);
    if (this.activeRouteId === routeId) {
      this.activeRouteId = this.routes[0]?.id || '';
    }
    this.notify();
    if (routeId) {
      routeService.deleteRoute(routeId).catch((err) => console.warn('Delete route server error:', err));
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
    let current = this.getActiveRoute();
    if (!current || !current.id) {
      current = this.createRoute('Yeni Keşif Rotam', [stop]);
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
    if (!current || fromIndex < 0 || toIndex < 0 || fromIndex >= current.stops.length || toIndex >= current.stops.length) {
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
      current.stops = current.stops.map((s) =>
        s.id === id ? { ...s, visited: !s.visited } : s
      );
      this.notify();
    }
  }

  public addFromPool(poolId: string) {
    const item = this.savedPool.find((p) => p.id === poolId);
    if (!item) return;
    this.savedPool = this.savedPool.filter((p) => p.id !== poolId);
    const newStop: TripStop = {
      ...item,
      id: `stop-${Date.now()}`,
      time: '15:30',
      duration: item.duration || '60 dk',
      walkTimeFromPrev: '~8 dk yürüyüş',
      distanceFromPrev: '500m',
    };
    const current = this.getActiveRoute();
    if (current && current.id) {
      current.stops = [...current.stops, newStop];
      this.notify();
      this.scheduleServerSync();
    }
  }

  public clearSavedPool() {
    this.savedPool = [];
    storage.removeItem('mb_saved_pool');
    this.notify();
  }

  public optimizeRoute() {
    const current = this.getActiveRoute();
    if (!current || current.stops.length <= 2) return;

    const stops = [...current.stops];
    const optimized: TripStop[] = [stops[0]];
    const remaining = stops.slice(1);

    while (remaining.length > 0) {
      const curr = optimized[optimized.length - 1];
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const dLat = remaining[i].lat - curr.lat;
        const dLng = remaining[i].lng - curr.lng;
        const dist = dLat * dLat + dLng * dLng;
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      const next = remaining.splice(nearestIdx, 1)[0];
      optimized.push(next);
    }

    const startHour = 9;
    current.stops = optimized.map((s, idx) => {
      const hour = startHour + Math.floor(idx * 1.2);
      const min = (idx * 25) % 60;
      return {
        ...s,
        time: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
        walkTimeFromPrev: idx === 0 ? '0 dk' : `~${4 + (idx % 4) * 2} dk yürüyüş`,
        distanceFromPrev: idx === 0 ? '0m' : `${300 + (idx % 5) * 80}m`,
      };
    });

    this.notify();
    this.scheduleServerSync();
  }

  public loadRouteFromExternal(name: string, stops: TripStop[]) {
    this.createRoute(name, stops);
  }

  // Pending add stop from map selection
  private pendingAddStopFlag: boolean = false;
  private pendingAddStopLocation: { lat: number; lng: number; name?: string; address?: string } | null = null;

  public setPendingAddStop(flag: boolean, location?: { lat: number; lng: number; name?: string; address?: string }) {
    this.pendingAddStopFlag = flag;
    this.pendingAddStopLocation = location || null;
  }

  public getPendingAddStop(): boolean {
    return this.pendingAddStopFlag;
  }

  public getPendingAddStopLocation(): { lat: number; lng: number; name?: string; address?: string } | null {
    return this.pendingAddStopLocation;
  }

  public clearPendingAddStop() {
    this.pendingAddStopFlag = false;
    this.pendingAddStopLocation = null;
  }

  public addStopFromMapSelection(lat: number, lng: number, name: string = 'Seçilen Konum', address: string = '') {
    const newStop: TripStop = {
      id: `stop-${Date.now()}`,
      name,
      category: 'MEKAN',
      time: '15:00',
      duration: '45 dk',
      address: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      lat,
      lng,
      rating: 4.8,
      walkTimeFromPrev: '~6 dk yürüyüş',
      distanceFromPrev: '400m',
    };
    this.addStop(newStop);
    this.clearPendingAddStop();
    return newStop;
  }
}

export const tripStore = new TripStore();
