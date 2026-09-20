// Free geocoding via OpenStreetMap Nominatim — no API key, no billing
// account. Used for two things:
//   1. Auto-filling a Property's lat/lng from its address when the admin
//      saves it (see createProperty/updateProperty in src/lib/db.ts).
//   2. Turning a customer's free-text search query into a point, so nearby
//      properties show up even when their ward/district name isn't
//      mentioned verbatim — e.g. searching a street name that isn't in our
//      address text at all still finds a property within NEARBY_RADIUS_KM.
//
// This is a *complement* to the keyword search in src/lib/search.ts, not a
// replacement — a room matches if EITHER the keywords match OR it's within
// the radius, so a geocoding hiccup never makes search worse than before.
//
// Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// requires a descriptive User-Agent and caps unauthenticated use at ~1
// request/second. Both are respected here: a real User-Agent below, an
// in-process cache so the same query text is never geocoded twice, and a
// short timeout so a slow/unreachable Nominatim never blocks a page render.

export const NEARBY_RADIUS_KM = 2;

export type GeoPoint = { lat: number; lng: number };

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 1 day — an address's coordinates don't change
const CACHE_MAX_ENTRIES = 500;
const geocodeCache = new Map<string, { point: GeoPoint | null; expiresAt: number }>();

function cacheGet(key: string): GeoPoint | null | undefined {
  const hit = geocodeCache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    geocodeCache.delete(key);
    return undefined;
  }
  return hit.point;
}

function cacheSet(key: string, point: GeoPoint | null): void {
  if (geocodeCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = geocodeCache.keys().next().value;
    if (oldestKey !== undefined) geocodeCache.delete(oldestKey);
  }
  geocodeCache.set(key, { point, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Conversational filler stripped BEFORE sending to the geocoder. Deliberately
// keeps Vietnamese diacritics intact (unlike src/lib/search.ts's ASCII
// keyword extraction, which is for matching our own address text — a real
// geocoding service understands proper Vietnamese place names better with
// diacritics kept).
const FILLER_PHRASES_VI = [
  "tôi muốn",
  "em muốn",
  "anh muốn",
  "chị muốn",
  "mình muốn",
  "cần tìm",
  "muốn tìm",
  "tìm kiếm",
  "đang tìm",
  "nhà ở",
  "phòng ở",
  "phòng gần",
  "nhà gần",
  "ở gần",
  "khu vực gần",
  "gần khu vực",
  "khu vực",
  "cho thuê",
  "để thuê",
  "muốn thuê",
  "cần thuê",
  "phòng cho thuê",
  "nhà cho thuê",
  "phòng trọ",
  "nhà trọ",
  "tôi",
  "em",
  "anh",
  "chị",
  "mình",
  "muốn",
  "cần",
  "tìm",
  "kiếm",
  "nhà",
  "phòng",
  "gần",
  "đường",
  "ở",
  "tại",
];

export function cleanLocationPhrase(query: string): string {
  let cleaned = ` ${query.trim()} `;
  for (const phrase of FILLER_PHRASES_VI) {
    cleaned = cleaned.replace(new RegExp(`\\s${phrase}\\s`, "gi"), " ");
  }
  return cleaned.replace(/\s+/g, " ").trim();
}

/** Best-effort: returns null (never throws) on any failure — a missing or
 * slow geocoding result must never break the listing page, only fall back
 * to the existing keyword search. */
export async function geocodeAddress(rawQuery: string): Promise<GeoPoint | null> {
  const query = cleanLocationPhrase(rawQuery);
  if (!query) return null;

  const cacheKey = query.toLowerCase();
  const cached = cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  const point = await fetchFromNominatim(query);
  cacheSet(cacheKey, point);
  return point;
}

// Global (module-level, single-process) throttle on outbound Nominatim
// calls, on top of the per-query cache above. The cache alone doesn't stop
// abuse — a flood of *distinct* query strings (e.g. someone hammering the
// public search box/API with garbage text) would still send a burst of
// real requests, which risks violating Nominatim's ~1 req/sec policy and
// getting this server's IP rate-limited or banned by them, breaking search
// for everyone. Found in QA; fixed by reserving the next allowed slot
// synchronously (before any `await`) so concurrent calls can't both slip
// through the check.
let lastRequestAt = 0;
const MIN_REQUEST_INTERVAL_MS = 1100;

async function fetchFromNominatim(query: string): Promise<GeoPoint | null> {
  const now = Date.now();
  if (now - lastRequestAt < MIN_REQUEST_INTERVAL_MS) {
    // Drop rather than queue — a slow/busy geocoder should never make a
    // customer's page wait. geocodeAddress()'s caller treats null the same
    // as any other geocoding miss: falls back to keyword-only search.
    return null;
  }
  lastRequestAt = now;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${query}, Việt Nam`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "vn");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: {
          // Required by Nominatim's usage policy — identifies the app, not a browser.
          "User-Agent": "RoomRentalListing/1.0 (small boarding-house listing site)",
          "Accept-Language": "vi",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) return null;
    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    if (!first) return null;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null; // network error, timeout, abort, bad JSON — degrade gracefully
  }
}

/** Great-circle distance in km between two lat/lng points (haversine formula). */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
