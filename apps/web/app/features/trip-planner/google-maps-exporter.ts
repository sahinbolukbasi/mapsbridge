import type { Pin } from "../../lib/trip/models";

/**
 * Generates a Google Maps directions URL with origin, destination, and waypoints.
 * Opens the URL in a new window/tab.
 */
export function exportTripToGoogleMaps(stops: Pin[]): { success: boolean; url?: string; message: string } {
  const validStops = (stops || []).filter(
    (p) =>
      typeof p.lat === "number" &&
      !isNaN(p.lat) &&
      typeof p.lng === "number" &&
      !isNaN(p.lng) &&
      p.lat !== 0 &&
      p.lng !== 0
  );

  if (validStops.length === 0) {
    return {
      success: false,
      message: "⚠️ Harita üzerinde geçerli koordinata sahip durak bulunamadı.",
    };
  }

  const origin = `${validStops[0].lat},${validStops[0].lng}`;
  const destination =
    validStops.length > 1
      ? `${validStops[validStops.length - 1].lat},${validStops[validStops.length - 1].lng}`
      : origin;
  const waypoints = validStops.slice(1, -1).map((p) => `${p.lat},${p.lng}`).join("|");

  let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    origin
  )}&destination=${encodeURIComponent(destination)}&travelmode=walking`;

  if (waypoints) {
    url += `&waypoints=${encodeURIComponent(waypoints)}`;
  }

  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  }

  return {
    success: true,
    url,
    message: "🧭 Rota Google Maps'e aktarıldı!",
  };
}
