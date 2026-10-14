/**
 * Local planning helpers and proposed tool definitions. These are not remote MCP tools.
 * The deployed AgentCore integration is agentcore-gateway.ts (research_places only).
 */

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const GATEWAY_TOOLS: Record<string, MCPToolDefinition> = {
  search_places: {
    name: 'search_places',
    description: 'Şehir içindeki ilgi noktalarını, müzeleri, restoran ve kafeleri arar.',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'Aranacak şehir' },
        category: { type: 'string', enum: ['cafe', 'restaurant', 'museum', 'park', 'viewpoint', 'hotel'] },
        query: { type: 'string', description: 'Arama terimi veya mekan adı' },
      },
      required: ['city', 'category'],
    },
  },
  calculate_transit: {
    name: 'calculate_transit',
    description: 'İki nokta arasındaki mesafe ve ulaşım süresini hesaplar (yürüme, toplu taşıma, taksi).',
    inputSchema: {
      type: 'object',
      properties: {
        origin: {
          type: 'object',
          properties: { lat: { type: 'number' }, lng: { type: 'number' } },
          required: ['lat', 'lng'],
        },
        destination: {
          type: 'object',
          properties: { lat: { type: 'number' }, lng: { type: 'number' } },
          required: ['lat', 'lng'],
        },
        mode: { type: 'string', enum: ['walking', 'subway', 'bus', 'taxi'] },
      },
      required: ['origin', 'destination'],
    },
  },
  weather_lookup: {
    name: 'weather_lookup',
    description: 'Hedef şehrin seyahat tarihleri için hava durumu tahminini ve yağış riskini döner.',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'Hedef şehir' },
        date: { type: 'string', description: 'Tarih (YYYY-MM-DD)' },
      },
      required: ['city'],
    },
  },
};

export interface TransitCalculationResult {
  mode: 'walking' | 'subway' | 'bus' | 'taxi';
  distanceKm: number;
  durationMinutes: number;
}

export function executeTransitCalculation(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  requestedMode: 'walking' | 'subway' | 'bus' | 'taxi' = 'subway'
): TransitCalculationResult {
  // Haversine formula for distance
  const R = 6371; // km
  const dLat = ((destination.lat - origin.lat) * Math.PI) / 180;
  const dLng = ((destination.lng - origin.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((origin.lat * Math.PI) / 180) *
      Math.cos((destination.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.round(R * c * 10) / 10;

  let speedKmH = 4.5; // walking default
  if (requestedMode === 'subway') speedKmH = 25;
  else if (requestedMode === 'bus') speedKmH = 15;
  else if (requestedMode === 'taxi') speedKmH = 30;

  // Transit overhead (wait time, station entry/exit)
  const overheadMinutes = requestedMode === 'walking' ? 0 : 7;
  const transitMinutes = Math.max(5, Math.round((distanceKm / speedKmH) * 60) + overheadMinutes);

  return {
    mode: requestedMode,
    distanceKm,
    durationMinutes: transitMinutes,
  };
}

export function executeWeatherLookup(city: string, date?: string): { forecast: string; isRainy: boolean } {
  // Deterministic seasonal / regional weather simulation for planning
  const normCity = city.toLocaleLowerCase('tr');
  const isNorthern = /londra|amsterdam|paris|berlin|new york/iu.test(normCity);

  if (isNorthern) {
    return {
      forecast: 'Parçalı bulutlu, ara sıra serpiştiren yağmur ihtimali, serin hava.',
      isRainy: true,
    };
  }
  return {
    forecast: 'Açık ve güneşli, seyahat ve açık hava yürüyüşleri için uygun sıcaklık.',
    isRainy: false,
  };
}
