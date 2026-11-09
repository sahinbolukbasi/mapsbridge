import pilot from "../../../../../data/travel/pilot.json";
import reviewed from "../../../../../data/travel/reviewed.json";
import type { TravelEvidence } from "./retrieval";
import type { MultiAgentRequestPayload } from "./types";
import { normalizeText } from "./planning";
import { CITY_ALIASES } from "./city-aliases";

/** A small reviewed corpus can still ground answers when vector retrieval is unavailable. */
export function bundledEvidence(
  payload: MultiAgentRequestPayload,
  now = Date.now(),
): TravelEvidence {
  const request = normalizeText(payload.prompt);
  if (
    !/yemek|yiy|yen|lezzet|kahve|mutfa|restoran|tapas|meze|sushi|ramen|pizza|makarna|kebap|balik|balık|ceviche|pisco|tapas|gastronomi|food|cafe|coffee|monjayaki|pisco|drink|ulasim|ulaşım|metro|tramvay|otobus|otobüs|vapur|transit|transport|nasil git|nereye|gez|rota/u.test(
      request,
    )
  )
    return { status: "empty", passages: [] };
  // Alias sözlüğü tek kaynaktan (city-aliases.ts) gelir; retrieval.ts ile aynı tablo.
  const aliases = CITY_ALIASES;
  let city: string | undefined;
  let last = -1;
  for (const [name, terms] of Object.entries(aliases))
    for (const alias of terms) {
      const pattern = new RegExp(`(?:^|[^\\p{L}])${alias}(?=$|[^\\p{L}])`, "gu");
      for (const match of request.matchAll(pattern))
        if (match.index! > last) {
          last = match.index!;
          city = name;
        }
    }
  if (!city && payload.researchDestination)
    city = Object.keys(aliases).find((name) =>
      aliases[name].some((a) => normalizeText(payload.researchDestination!).includes(a)),
    );
  if (!city) return { status: "empty", passages: [] };
  const passages = [...pilot, ...reviewed]
    .filter(
      (r) =>
        r.city === city &&
        r.approved &&
        r.visibility === "public" &&
        Date.parse(r.checked_at) <= now &&
        Date.parse(r.valid_until) > now &&
        Date.parse(r.valid_until) - Date.parse(r.checked_at) <= 180 * 86400000,
    )
    .filter((r) => {
      try {
        const url = new URL(r.source_url);
        return url.protocol === "https:" && !url.username && !url.password;
      } catch {
        return false;
      }
    })
    .slice(0, 4)
    .map((r, i) => ({
      id: `L${i + 1}`,
      title: r.title,
      url: r.source_url,
      checkedAt: r.checked_at,
      text: r.text.slice(0, 1800),
    }));
  return { status: passages.length ? "available" : "empty", passages };
}

export function mergeEvidence(remote: TravelEvidence, local: TravelEvidence): TravelEvidence {
  const passages = [...remote.passages];
  for (const source of local.passages)
    if (!passages.some((p) => p.url === source.url) && passages.length < 6) passages.push(source);
  return {
    status: passages.length ? "available" : remote.status,
    passages,
    // Grounding ölçümü (görev 4): kaç pasaj uzaktan (RAG), kaç yerel korpustan,
    // dedupe + sınır sonrası kaç tane kaldı. recordAIOperation evidenceCounts'a geçer.
    counts: {
      remote: remote.passages.length,
      local: local.passages.length,
      merged: passages.length,
    },
  };
}
