"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Pin } from "../../lib/trip/models";
import { googleMapsConfig, loadGoogleMaps, searchGooglePlaces } from "../../lib/google/maps-client";

export type GooglePoint = {
  lat: number;
  lng: number;
  address: string;
  name?: string;
  googlePlaceId?: string;
  category?: string;
};

export type GoogleMapHandle = {
  focus: (lat: number, lng: number) => void;
  setZoom: (zoom: number) => void;
  setMapType: (type: "roadmap" | "satellite" | "terrain" | "hybrid") => void;
};

type Props = {
  pins: Pin[];
  selectedId: string | null;
  point: GooglePoint | null;
  path: [number, number][];
  onPoint: (point: GooglePoint) => void;
  onPin: (id: string) => void;
  onReady: (handle: GoogleMapHandle) => void;
  onError: () => void;
  onAddPlaceToTrip?: (place: {
    label: string;
    address: string;
    lat: number;
    lng: number;
    category: string;
    googlePlaceId?: string;
  }) => void;
};

const QUICK_CATEGORIES = [
  { id: "kahve", label: "Kahve", emoji: "☕", query: "kafe kahve" },
  { id: "yemek", label: "Restoran", emoji: "🍽️", query: "restoran yemek" },
  { id: "otel", label: "Otel", emoji: "🏨", query: "otel konaklama hotel" },
  { id: "muze", label: "Müze", emoji: "🏛️", query: "müze tarihi yer" },
  { id: "doga", label: "Park", emoji: "🌳", query: "park sahil manzara" },
  { id: "alisveris", label: "Çarşı", emoji: "🛍️", query: "alışveriş çarşı pazar" },
];

type MapTypeId = "roadmap" | "satellite" | "terrain" | "hybrid";

const MAP_TYPE_OPTIONS: { id: MapTypeId; label: string; icon: string }[] = [
  { id: "roadmap", label: "Standart", icon: "map" },
  { id: "satellite", label: "Uydu", icon: "satellite_alt" },
  { id: "terrain", label: "Arazi", icon: "terrain" },
  { id: "hybrid", label: "Hibrit", icon: "layers" },
];

export function GooglePlannerMap(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const latest = useRef(props);
  latest.current = props;

  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [results, setResults] = useState<google.maps.places.Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mapType, setMapTypeState] = useState<MapTypeId>("roadmap");
  const [locating, setLocating] = useState(false);
  const [showMapTypeSelector, setShowMapTypeSelector] = useState(false);
  const [transitLayerOn, setTransitLayerOn] = useState(false);

  const handle = useRef<GoogleMapHandle | null>(null);
  const previousPins = useRef("");
  const transitLayerRef = useRef<google.maps.TransitLayer | null>(null);

  // Search places using Google Places library
  const performSearch = useCallback(async (searchQuery: string, categoryId?: string) => {
    if (!searchQuery.trim()) return;
    setBusy(true);
    setError("");
    setActiveCategory(categoryId || null);
    try {
      const center = mapRef.current?.getCenter()?.toJSON();
      const places = await searchGooglePlaces(searchQuery, center);
      setResults(places);
      if (!places.length) {
        setError("Bu bölgede eşleşen mekan bulunamadı.");
      }
    } catch {
      setError("Mekan araması yapılamadı. Bağlantınızı kontrol edin.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Map initialization
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let listener: google.maps.MapsEventListener | undefined;

    const failed = () => {
      if (!disposed) latest.current.onError();
    };
    window.addEventListener("mapsbridge:google-auth-error", failed);

    void loadGoogleMaps()
      .then(async () => {
        const { Map } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
        await google.maps.importLibrary("marker");
        if (disposed || !container.current) return;

        const first = latest.current.pins[0];
        const initialCenter = first
          ? { lat: first.lat, lng: first.lng }
          : { lat: 41.0082, lng: 28.9784 };

        const map = new Map(container.current, {
          center: initialCenter,
          zoom: 14,
          mapId: googleMapsConfig.mapId || "DEMO_MAP_ID",
          gestureHandling: "greedy",
          clickableIcons: true,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          zoomControl: false,
        });

        mapRef.current = map;

        // Initialize transit layer
        transitLayerRef.current = new google.maps.TransitLayer();

        handle.current = {
          focus: (lat, lng) => {
            map.setZoom(16);
            map.panTo({ lat, lng });
          },
          setZoom: (zoom) => {
            map.setZoom(zoom);
          },
          setMapType: (type) => {
            map.setMapTypeId(type);
          },
        };

        listener = map.addListener(
          "click",
          (event: google.maps.MapMouseEvent & { placeId?: string; stop?: () => void }) => {
            if (!event.latLng) return;
            event.stop?.();
            const point: GooglePoint = {
              lat: event.latLng.lat(),
              lng: event.latLng.lng(),
              address: event.placeId
                ? "Google Maps Seçilen Nokta"
                : `${event.latLng.lat().toFixed(5)}, ${event.latLng.lng().toFixed(5)}`,
              name: event.placeId ? "İşaretlenen Mekan" : "Harita Noktası",
              googlePlaceId: event.placeId,
              category: "genel",
            };
            latest.current.onPoint(point);
            handle.current?.focus(point.lat, point.lng);
          },
        );

        observer = new ResizeObserver(() => google.maps.event.trigger(map, "resize"));
        observer.observe(container.current);

        setReady(true);
        latest.current.onReady(handle.current);
      })
      .catch(failed);

    return () => {
      disposed = true;
      observer?.disconnect();
      listener?.remove();
      window.removeEventListener("mapsbridge:google-auth-error", failed);
      if (mapRef.current) google.maps.event.clearInstanceListeners(mapRef.current);
      mapRef.current = null;
    };
  }, []);

  // Update Markers & Polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    const markers = props.pins.map((pin) => {
      const selected = pin.id === props.selectedId;
      const glyph = document.createElement("span");
      glyph.className = "google-pin-glyph";
      glyph.textContent = pin.visited ? "✓" : String(pin.order || "•");

      const isHotel = pin.category === "otel" || /otel|hotel|hostel|pansiyon/i.test(pin.label);
      const isFood = pin.category === "yemek" || pin.category === "kahve";
      const bgColor = selected ? "#10b981" : isHotel ? "#0284c7" : isFood ? "#f59e0b" : "#176548";

      const visual = new google.maps.marker.PinElement({
        background: bgColor,
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
        scale: selected ? 1.25 : 1.05,
        glyph,
      });

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: pin.lat, lng: pin.lng },
        title: pin.label,
        content: visual.element,
        zIndex: selected ? 20 : 5,
      });

      marker.addListener("click", () => {
        latest.current.onPin(pin.id);
        handle.current?.focus(pin.lat, pin.lng);
      });
      return marker;
    });

    if (props.point) {
      const pointGlyph = document.createElement("span");
      pointGlyph.textContent = "★";
      const pointVisual = new google.maps.marker.PinElement({
        background: "#ec4899",
        borderColor: "#fff",
        glyphColor: "#fff",
        scale: 1.2,
        glyph: pointGlyph,
      });

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: props.point.lat, lng: props.point.lng },
        title: props.point.name || "Seçilen Konum",
        content: pointVisual.element,
        zIndex: 25,
      });
      marker.addListener("click", () => latest.current.onPoint(latest.current.point!));
      markers.push(marker);
    }

    const signature = props.pins.map((pin) => pin.id).join(",");
    if (props.pins.length && previousPins.current !== signature) {
      previousPins.current = signature;
      const target = props.pins.find((pin) => pin.id === props.selectedId) || props.pins[0];
      handle.current?.focus(target.lat, target.lng);
    }

    const line =
      props.path.length > 1
        ? new google.maps.Polyline({
            map,
            path: props.path.map(([lat, lng]) => ({ lat, lng })),
            strokeColor: "#059669",
            strokeOpacity: 0.9,
            strokeWeight: 5,
            geodesic: true,
          })
        : undefined;

    return () => {
      markers.forEach((marker) => {
        google.maps.event.clearInstanceListeners(marker);
        marker.map = null;
      });
      line?.setMap(null);
    };
  }, [ready, props.pins, props.selectedId, props.point, props.path]);

  // Toggle transit layer
  const toggleTransitLayer = useCallback(() => {
    if (!mapRef.current || !transitLayerRef.current) return;
    if (transitLayerOn) {
      transitLayerRef.current.setMap(null);
    } else {
      transitLayerRef.current.setMap(mapRef.current);
    }
    setTransitLayerOn(!transitLayerOn);
  }, [transitLayerOn]);

  // Geolocation fly-to
  const handleMyLocation = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        mapRef.current?.panTo({ lat: latitude, lng: longitude });
        mapRef.current?.setZoom(16);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  // Map type switch
  const switchMapType = (type: MapTypeId) => {
    if (!mapRef.current) return;
    mapRef.current.setMapTypeId(type);
    setMapTypeState(type);
    setShowMapTypeSelector(false);
  };

  // Close search results
  const clearResults = () => {
    setResults([]);
    setError("");
    setActiveCategory(null);
  };

  return (
    <div className="google-planner-map">
      {/* Google Maps Viewport */}
      <div ref={container} className="google-map-canvas" aria-label="Google Seyahat Haritası" />

      {/* Floating Modern Glassmorphic Search Header */}
      <div className="google-map-floating-header">
        <form
          className="google-map-search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            performSearch(query);
          }}
        >
          <span className="material-symbols-outlined gmap-search-icon" aria-hidden="true">
            search
          </span>
          <label className="sr-only" htmlFor="google-place-query">
            Google Maps'te mekan, otel veya kafe ara
          </label>
          <input
            id="google-place-query"
            placeholder="Mekan, otel veya restoran ara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="gmap-clear-btn"
              onClick={() => {
                setQuery("");
                clearResults();
              }}
              title="Aramayı temizle"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          )}
          <button disabled={!ready || busy} type="submit" className="gmap-submit-btn">
            {busy ? <span className="gmap-spinner" /> : "Keşfet"}
          </button>
        </form>

        {/* Quick Filter Categories */}
        <div className="google-map-quick-categories">
          {QUICK_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`gmap-cat-chip ${activeCategory === cat.id ? "active" : ""}`}
              onClick={() => {
                setQuery(cat.query);
                performSearch(cat.query, cat.id);
              }}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Search Results Dropdown Card */}
        {(error || results.length > 0) && (
          <div className="google-search-results-panel">
            <div className="gmap-results-head">
              <span>{results.length ? `${results.length} Mekan Bulundu` : "Arama Sonucu"}</span>
              <button type="button" className="gmap-results-close" onClick={clearResults}>
                <span
                  className="material-symbols-outlined"
                  aria-hidden="true"
                  style={{ fontSize: "14px" }}
                >
                  close
                </span>
                Kapat
              </button>
            </div>

            {error && <div className="gmap-results-error">{error}</div>}

            {results.length > 0 && (
              <div className="google-search-results-list">
                {results.map((place) => {
                  const loc = place.location?.toJSON();
                  const name = place.displayName || "Google Mekanı";
                  const address = place.formattedAddress || "";
                  return (
                    <div key={place.id} className="gmap-result-item">
                      <div className="gmap-item-meta">
                        <strong className="gmap-item-name">{name}</strong>
                        {address && <span className="gmap-item-address">{address}</span>}
                      </div>
                      <div className="gmap-item-actions">
                        <button
                          type="button"
                          className="gmap-item-btn secondary"
                          onClick={() => {
                            if (!loc) return;
                            handle.current?.focus(loc.lat, loc.lng);
                          }}
                          title="Haritada göster"
                        >
                          <span
                            className="material-symbols-outlined"
                            aria-hidden="true"
                            style={{ fontSize: "15px" }}
                          >
                            location_on
                          </span>
                          Göster
                        </button>
                        <button
                          type="button"
                          className="gmap-item-btn primary"
                          onClick={() => {
                            if (!loc) return;
                            const point: GooglePoint = {
                              lat: loc.lat,
                              lng: loc.lng,
                              address: address || name,
                              name,
                              googlePlaceId: place.id,
                              category: activeCategory || "genel",
                            };
                            props.onPoint(point);
                            if (props.onAddPlaceToTrip) {
                              props.onAddPlaceToTrip({
                                label: name,
                                address: address || name,
                                lat: loc.lat,
                                lng: loc.lng,
                                category: activeCategory || "genel",
                                googlePlaceId: place.id,
                              });
                            }
                            handle.current?.focus(loc.lat, loc.lng);
                            clearResults();
                          }}
                          title="Bu mekanı rotaya ekle"
                        >
                          <span
                            className="material-symbols-outlined"
                            aria-hidden="true"
                            style={{ fontSize: "15px" }}
                          >
                            add_circle
                          </span>
                          Ekle
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Modern Map Controls (Right Side) */}
      <div className="google-map-floating-controls" aria-label="Harita Kontrolleri">
        {/* Map Type Selector */}
        <div className="gmap-control-group">
          <button
            type="button"
            className={`gmap-tool-btn ${showMapTypeSelector ? "active" : ""}`}
            title="Harita Görünümü"
            onClick={() => setShowMapTypeSelector(!showMapTypeSelector)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {MAP_TYPE_OPTIONS.find((t) => t.id === mapType)?.icon || "layers"}
            </span>
          </button>

          {/* Map Type Popover */}
          {showMapTypeSelector && (
            <div className="gmap-maptype-popover">
              <div className="gmap-popover-title">Harita Görünümü</div>
              <div className="gmap-maptype-grid">
                {MAP_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`gmap-maptype-option ${mapType === opt.id ? "active" : ""}`}
                    onClick={() => switchMapType(opt.id)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      {opt.icon}
                    </span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>

              <div className="gmap-popover-divider" />

              {/* Transit Toggle */}
              <button
                type="button"
                className={`gmap-transit-toggle ${transitLayerOn ? "active" : ""}`}
                onClick={toggleTransitLayer}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  directions_transit
                </span>
                <span>Toplu Taşıma</span>
                <span className={`gmap-toggle-indicator ${transitLayerOn ? "on" : ""}`} />
              </button>
            </div>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="gmap-tool-group">
          <button
            type="button"
            className="gmap-tool-btn"
            title="Yakınlaştır"
            onClick={() => {
              if (!mapRef.current) return;
              mapRef.current.setZoom((mapRef.current.getZoom() || 14) + 1);
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              add
            </span>
          </button>
          <button
            type="button"
            className="gmap-tool-btn"
            title="Uzaklaştır"
            onClick={() => {
              if (!mapRef.current) return;
              mapRef.current.setZoom((mapRef.current.getZoom() || 14) - 1);
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              remove
            </span>
          </button>
        </div>

        {/* My Location */}
        <button
          type="button"
          className={`gmap-tool-btn ${locating ? "spinning" : ""}`}
          title="Mevcut Konumum"
          onClick={handleMyLocation}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            my_location
          </span>
        </button>
      </div>

      {/* Click-away backdrop for map type popover */}
      {showMapTypeSelector && (
        <div className="gmap-popover-backdrop" onClick={() => setShowMapTypeSelector(false)} />
      )}
    </div>
  );
}
