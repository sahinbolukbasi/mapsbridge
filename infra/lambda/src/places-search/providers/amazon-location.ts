// Amazon Location (geo-places v2) adaptörü. ai rolü IAM'i (travel-rag.tf `place_research`):
// Geocode, SearchText, ReverseGeocode, GetPlace, SearchNearby. Sağlayıcı hatası →
// ProviderUnavailable (503); hata asla uydurma sonuca dönüşmez (I1).
import {
  GeocodeCommand,
  GeoPlacesClient,
  GetPlaceCommand,
  ReverseGeocodeCommand,
  SearchNearbyCommand,
  SearchTextCommand,
} from "@aws-sdk/client-geo-places";
import {
  ATTRIBUTION,
  CATEGORY_QUERY,
  LIMITS,
  ProviderUnavailable,
  type Place,
  type PlacesProvider,
  type PlacesQuery,
} from "../places.service";

type AmazonItem = {
  PlaceId?: string;
  Title?: string;
  Address?: { Label?: string };
  Position?: number[];
  Categories?: Array<{ Id?: string; Name?: string; LocalizedName?: string; Primary?: boolean }>;
  OpeningHours?: Array<{ Display?: string[] }>;
  Contacts?: { Phones?: Array<{ Value?: string }>; Websites?: Array<{ Value?: string }> };
};

let geo: GeoPlacesClient | null = null;
const client = () =>
  (geo ||= new GeoPlacesClient({
    region: process.env.AWS_REGION || "eu-central-1",
    maxAttempts: 2,
  }));

/** Amazon sonucunu normalize eder; yalnız dönen alanlar yazılır. */
export function fromAmazon(item: AmazonItem): Partial<Place> {
  const [lng, lat] = Array.isArray(item.Position) ? item.Position : [];
  const category = item.Categories?.find((c) => c.Primary) ?? item.Categories?.[0] ?? undefined;
  const hours = item.OpeningHours?.flatMap((h) => h.Display || []).filter(Boolean);
  return {
    id: item.PlaceId,
    provider: "amazon",
    name: item.Title,
    lat,
    lng,
    address: item.Address?.Label,
    category: category?.LocalizedName || category?.Name,
    openingHours: hours && hours.length ? hours : undefined,
    phone: item.Contacts?.Phones?.[0]?.Value,
    website: item.Contacts?.Websites?.[0]?.Value,
    attribution: ATTRIBUTION.amazon,
  };
}

function mapError(err: unknown): never {
  const name = (err as { name?: string })?.name || "";
  if (/AccessDenied|UnrecognizedClient|ExpiredToken|Credentials/i.test(name))
    throw new ProviderUnavailable("amazon_access_denied");
  if (/Timeout|Abort/i.test(name)) throw new ProviderUnavailable("amazon_timeout");
  throw new ProviderUnavailable(`amazon_${name || "error"}`);
}

const opts = () => ({ abortSignal: AbortSignal.timeout(3500) });

export const amazonLocation: PlacesProvider = {
  id: "amazon",
  async run(query: PlacesQuery): Promise<Place[]> {
    try {
      if (query.op === "search") {
        const text = (
          query.category ? `${CATEGORY_QUERY[query.category]} ${query.q}` : query.q
        ).slice(0, 150);
        // SearchText tam olarak bir konum bağlamı ister (BiasPosition ya da Filter); yoksa
        // ValidationException → 503 (canlı hata: konumsuz arama). Konum yoksa önce Geocode
        // (konum gerektirmez) ile metnin yerini bul, SearchText'i oraya yönlendir.
        let bias = query.near ? [query.near[1], query.near[0]] : undefined;
        let geocoded: Place[] = [];
        if (!bias) {
          const geo = await client().send(
            new GeocodeCommand({
              QueryText: text,
              MaxResults: LIMITS.maxResults,
              Language: query.lang,
              IntendedUse: "Storage",
            }),
            opts(),
          );
          geocoded = (geo.ResultItems || []).map((i) => fromAmazon(i as AmazonItem) as Place);
          const first = geo.ResultItems?.find((i) => Array.isArray(i.Position))?.Position;
          if (!first) return geocoded;
          bias = [first[0], first[1]];
        }
        const res = await client().send(
          new SearchTextCommand({
            QueryText: text,
            BiasPosition: bias,
            MaxResults: LIMITS.maxResults,
            Language: query.lang,
            IntendedUse: "Storage",
          }),
          opts(),
        );
        const found = (res.ResultItems || []).map((i) => fromAmazon(i as AmazonItem) as Place);
        return found.length ? found : geocoded;
      }
      if (query.op === "nearby") {
        // Kategorili keşif bugünkü IAM'le (SearchText) çalışır; kategorisiz yakın arama
        // SearchNearby ister (IAM eklenene kadar unavailable).
        const res = query.category
          ? await client().send(
              new SearchTextCommand({
                QueryText: CATEGORY_QUERY[query.category],
                Filter: { Circle: { Center: [query.lng, query.lat], Radius: query.radius } },
                MaxResults: LIMITS.maxResults,
                Language: query.lang,
                IntendedUse: "Storage",
              }),
              opts(),
            )
          : await client().send(
              new SearchNearbyCommand({
                QueryPosition: [query.lng, query.lat],
                QueryRadius: query.radius,
                MaxResults: LIMITS.maxResults,
                Language: query.lang,
                IntendedUse: "Storage",
              }),
              opts(),
            );
        return (res.ResultItems || []).map((i) => fromAmazon(i as AmazonItem) as Place);
      }
      if (query.op === "reverse") {
        const res = await client().send(
          new ReverseGeocodeCommand({
            QueryPosition: [query.lng, query.lat],
            MaxResults: 1,
            Language: query.lang,
            IntendedUse: "Storage",
          }),
          opts(),
        );
        return (res.ResultItems || []).map((i) => fromAmazon(i as AmazonItem) as Place);
      }
      const res = await client().send(
        new GetPlaceCommand({
          PlaceId: query.id,
          AdditionalFeatures: ["Contact"],
          Language: query.lang,
          IntendedUse: "Storage",
        }),
        opts(),
      );
      return [fromAmazon(res as AmazonItem) as Place];
    } catch (err) {
      if (err instanceof ProviderUnavailable) throw err;
      return mapError(err);
    }
  },
};
