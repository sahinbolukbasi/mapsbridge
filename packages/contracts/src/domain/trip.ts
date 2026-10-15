import { ValidationException } from "./exceptions";
import type { RouteStopDto, UnifiedRoutePlanDto } from "../index";

/**
 * Coordinate Value Object
 * Invariant: -90 <= lat <= 90, -180 <= lng <= 180
 */
export class Coordinate {
  public readonly lat: number;
  public readonly lng: number;

  constructor(lat: number, lng: number) {
    if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) {
      throw new ValidationException(`Invalid coordinate values: lat=${lat}, lng=${lng}`);
    }
    if (lat < -90 || lat > 90) {
      throw new ValidationException(`Latitude ${lat} out of bounds [-90, 90]`);
    }
    if (lng < -180 || lng > 180) {
      throw new ValidationException(`Longitude ${lng} out of bounds [-180, 180]`);
    }
    this.lat = lat;
    this.lng = lng;
  }

  public equals(other: Coordinate): boolean {
    return this.lat === other.lat && this.lng === other.lng;
  }
}

/**
 * RouteStop Domain Entity
 */
export class RouteStop {
  public readonly id: string;
  public readonly name: string;
  public readonly coordinate: Coordinate;
  public readonly day: number;
  public readonly description?: string;
  public readonly estimatedMinutes: number;
  public readonly timeSlot?: "morning" | "afternoon" | "evening" | "night";
  public readonly category?: string;
  public readonly address?: string;

  constructor(props: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    day: number;
    description?: string;
    estimatedMinutes?: number;
    timeSlot?: "morning" | "afternoon" | "evening" | "night";
    category?: string;
    address?: string;
  }) {
    if (!props.id || !props.name?.trim()) {
      throw new ValidationException("Route stop id and non-empty name are required.");
    }
    if (props.day < 1) {
      throw new ValidationException(`Stop day must be >= 1, received: ${props.day}`);
    }
    this.id = props.id;
    this.name = props.name.trim();
    this.coordinate = new Coordinate(props.lat, props.lng);
    this.day = props.day;
    this.description = props.description;
    this.estimatedMinutes = Math.max(15, props.estimatedMinutes || 60);
    this.timeSlot = props.timeSlot;
    this.category = props.category;
    this.address = props.address;
  }

  public toDto(): RouteStopDto {
    return {
      id: this.id,
      name: this.name,
      lat: this.coordinate.lat,
      lng: this.coordinate.lng,
      day: this.day,
      description: this.description,
      suggestedDuration: `${this.estimatedMinutes} dk`,
      estimatedMinutes: this.estimatedMinutes,
      timeSlot: this.timeSlot,
      category: this.category,
      address: this.address,
    };
  }
}

/**
 * Trip / Route Aggregate Root
 * Enforces multi-day itineraries, stop ordering and feasibility constraints.
 */
export class Trip {
  private readonly _id: string;
  private _title: string;
  private _destination: string;
  private _summary: string;
  private _theme: string;
  private _stops: RouteStop[];

  constructor(props: {
    id: string;
    title: string;
    destination: string;
    summary?: string;
    theme?: string;
    stops?: RouteStop[];
  }) {
    if (!props.id || !props.title?.trim()) {
      throw new ValidationException("Trip id and non-empty title are required.");
    }
    if (!props.destination?.trim()) {
      throw new ValidationException("Trip destination is required.");
    }
    this._id = props.id;
    this._title = props.title.trim();
    this._destination = props.destination.trim();
    this._summary = props.summary || "";
    this._theme = props.theme || "Kültür & Şehir Keşfi";
    this._stops = props.stops ? [...props.stops] : [];
  }

  get id(): string {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get destination(): string {
    return this._destination;
  }

  get summary(): string {
    return this._summary;
  }

  get theme(): string {
    return this._theme;
  }

  get stops(): ReadonlyArray<RouteStop> {
    return this._stops;
  }

  get totalDays(): number {
    if (this._stops.length === 0) return 1;
    return Math.max(1, ...this._stops.map((s) => s.day));
  }

  public addStop(stop: RouteStop): void {
    if (this._stops.some((s) => s.id === stop.id)) {
      throw new ValidationException(`Stop with id '${stop.id}' already exists in trip.`);
    }
    this._stops.push(stop);
  }

  public removeStop(stopId: string): void {
    this._stops = this._stops.filter((s) => s.id !== stopId);
  }

  public getStopsForDay(day: number): RouteStop[] {
    return this._stops.filter((s) => s.day === day);
  }

  public calculateDayDurationMinutes(day: number, transitPerStopMinutes = 15): number {
    const dayStops = this.getStopsForDay(day);
    if (dayStops.length === 0) return 0;
    const visits = dayStops.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const transit = Math.max(0, (dayStops.length - 1) * transitPerStopMinutes);
    return visits + transit;
  }

  /**
   * Section 5.4 feasibility rule: Warn if a single day exceeds 8.5 hours (510 mins).
   */
  public isDayHeavy(day: number, maxMinutes = 510): boolean {
    return this.calculateDayDurationMinutes(day) > maxMinutes;
  }

  public toDto(): UnifiedRoutePlanDto {
    return {
      title: this._title,
      summary: this._summary,
      destination: this._destination,
      theme: this._theme,
      estimatedDays: this.totalDays,
      stops: this._stops.map((s) => s.toDto()),
    };
  }

  public static fromDto(id: string, dto: UnifiedRoutePlanDto): Trip {
    const stops = (dto.stops || []).map(
      (s, idx) =>
        new RouteStop({
          id: s.id || `stop-${idx + 1}`,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          day: s.day || 1,
          description: s.description,
          estimatedMinutes: s.estimatedMinutes,
          timeSlot: s.timeSlot,
          category: s.category,
          address: s.address,
        }),
    );
    return new Trip({
      id,
      title: dto.title,
      destination: dto.destination,
      summary: dto.summary,
      theme: dto.theme,
      stops,
    });
  }
}
