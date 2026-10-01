// Type-ahead location search — round 16. Client-safe (no DB, no network).
//
// Why: the mobile search box used to send whatever the customer typed to the
// free-text address search, which needs EVERY word to appear in a
// building's address. "TP HCM", "Sài Gòn", "Q7", "phu thuan hcm" all found
// nothing, because the stored address says "Thành phố Hồ Chí Minh" /
// "Quận 7". Now every keystroke is matched against the official
// administrative lists (34 provinces, ~3,320 wards — the same bundled lists
// the desktop dropdowns use — plus HCMC's pre-2025 districts) and the
// buildings, and the customer picks a real place, which becomes an exact
// city / ward / district filter.
//
// Matching rules (normalizeSearchText strips accents/case/punctuation):
//   - every typed word must be the START of some word of the candidate
//     ("phu th" → "Phường Phú Thuận"; "p phu thuan" works since "p" starts
//     "phuong");
//   - candidates also carry aliases: "hcm", "tphcm", "sai gon", "sg" for
//     HCMC, initials for every province ("hn", "dn"…), "q7" for "Quận 7";
//   - filler words ("phòng", "tìm", "ở", "gần"…) are ignored.
import vnProvinces from "@/data/vn-provinces.json";
import vnWards from "@/data/vn-wards.json";
import vnHcmDistricts from "@/data/vn-hcm-districts.json";
import { normalizeSearchText } from "@/lib/search";

export const HCM_CITY = "Thành phố Hồ Chí Minh";

export type LocationKind = "city" | "ward" | "district" | "building";

export interface LocationHit {
  kind: LocationKind;
  /** e.g. "Phường Phú Thuận" */
  label: string;
  /** e.g. "TP. Hồ Chí Minh" */
  sub: string;
  /** Homepage query string (without "?") that applies this place. */
  query: string;
  /** Available rooms there right now (from the server). */
  count: number;
  score: number;
}

/** Available-room counts sent by the homepage (server side). Keys: city
 * name; `${city}|${ward}`; district name; building id. */
export interface LocationCounts {
  city: Record<string, number>;
  ward: Record<string, number>;
  district: Record<string, number>;
}

export interface BuildingOption {
  id: string;
  name: string;
  address: string;
  ward: string;
  available: number;
}

// Conversational words dropped ONLY when the full query matches nothing —
// several are also real place-name words ("Nhà Bè", "Cần Thơ", "Chợ Lớn").
const FILLER = new Set([
  "phong", "tim", "kiem", "cho", "thue", "o", "tai", "gan", "can", "nha", "toi",
  "muon", "khu", "vuc", "tro", "o", "minh", "em", "anh", "chi",
]);

/** "Thành phố Hồ Chí Minh" → "TP. Hồ Chí Minh"; "Tỉnh Lâm Đồng" → "Lâm Đồng". */
export function shortCityName(city: string): string {
  return city.replace(/^Thành phố\s+/i, "TP. ").replace(/^Tỉnh\s+/i, "");
}

const stripCityPrefix = (c: string) => c.replace(/^(Thành phố|Tỉnh)\s+/i, "");

/** Extra words a province is known by: initials ("ho chi minh" → "hcm"),
 * "tp"+initials, and a few common nicknames. */
export function cityAliases(city: string): string[] {
  const core = normalizeSearchText(stripCityPrefix(city));
  const initials = core
    .split(" ")
    .map((w) => w[0])
    .join("");
  const out = [initials, `tp${initials}`, "tp"];
  if (city === HCM_CITY) out.push("sai gon", "saigon", "sg", "tphcm", "hcmc");
  if (core === "ha noi") out.push("hanoi");
  if (core === "da nang") out.push("danang");
  return out;
}

/** "Quận 7" → ["q7", "q 7"]; other districts get their initials ("Bình
 * Thạnh" → "bt"). */
export function districtAliases(district: string): string[] {
  const n = normalizeSearchText(district);
  const m = n.match(/^quan (\d+)$/);
  if (m) return [`q${m[1]}`];
  return [n.split(" ").map((w) => w[0]).join("")];
}

interface Entry {
  kind: Exclude<LocationKind, "building">;
  label: string;
  sub: string;
  query: string;
  city: string;
  countKey: string;
  words: string[];
  /** Words of the place's own name (+ its aliases), without the city part. */
  ownWords: string[];
  core: string; // normalized label without its "Phường/Quận/Thành phố" prefix
}

let index: Entry[] | null = null;

function buildIndex(): Entry[] {
  const provinceByCode = new Map(vnProvinces.map((p) => [p.code, p.name]));
  const entries: Entry[] = [];
  for (const p of vnProvinces) {
    const words = `${normalizeSearchText(p.name)} ${cityAliases(p.name).join(" ")}`;
    entries.push({
      kind: "city",
      label: p.name,
      sub: "Tỉnh / thành phố",
      query: `city=${encodeURIComponent(p.name)}`,
      city: p.name,
      countKey: p.name,
      words: words.split(" "),
      ownWords: words.split(" "),
      core: normalizeSearchText(stripCityPrefix(p.name)),
    });
  }
  for (const w of vnWards) {
    const city = provinceByCode.get(w.pc);
    if (!city) continue;
    const words = `${normalizeSearchText(w.w)} ${normalizeSearchText(city)} ${cityAliases(city).join(" ")}`;
    entries.push({
      kind: "ward",
      label: w.w,
      sub: shortCityName(city),
      query: `city=${encodeURIComponent(city)}&ward=${encodeURIComponent(w.w)}`,
      city,
      countKey: `${city}|${w.w}`,
      words: words.split(" "),
      ownWords: normalizeSearchText(w.w).split(" "),
      core: normalizeSearchText(w.w.replace(/^(Phường|Xã|Đặc khu|Thị trấn)\s+/i, "")),
    });
  }
  for (const d of vnHcmDistricts) {
    const words = `${normalizeSearchText(d)} ${districtAliases(d).join(" ")} quan huyen cu ${normalizeSearchText(HCM_CITY)} ${cityAliases(HCM_CITY).join(" ")}`;
    entries.push({
      kind: "district",
      label: `${d} (cũ)`,
      sub: "Quận/huyện cũ · TP. Hồ Chí Minh",
      query: `city=${encodeURIComponent(HCM_CITY)}&district=${encodeURIComponent(d)}`,
      city: HCM_CITY,
      countKey: d,
      words: words.split(" "),
      ownWords: `${normalizeSearchText(d)} ${districtAliases(d).join(" ")}`.split(" "),
      core: normalizeSearchText(d.replace(/^(Quận|Huyện|Thành phố)\s+/i, "")),
    });
  }
  return entries;
}

const cityWordCache = new Map<string, string[]>();
function cityWordsOf(city: string): string[] {
  let w = cityWordCache.get(city);
  if (!w) {
    w = `${normalizeSearchText(city)} ${cityAliases(city).join(" ")}`.split(" ");
    cityWordCache.set(city, w);
  }
  return w;
}

function queryTokens(q: string, dropFiller = false): string[] {
  return normalizeSearchText(q)
    .split(" ")
    .filter((t) => t && !(dropFiller && FILLER.has(t)));
}

// Administrative-type words ("Phường", "Xã", "Quận", "Thành phố"…). A typed
// word that only matches one of these by prefix doesn't count ("phu" must
// not match "phuong" — else "phu thuan" also finds "Phường Thuận An"),
// unless it IS that word or its abbreviation ("p", "phuong", "tp").
const TYPE_WORDS = new Set(["phuong", "xa", "thi", "tran", "dac", "khu", "quan", "huyen", "thanh", "pho", "tinh"]);
const TYPE_ABBR = new Set(["p", "x", "q", "tp", "tx", "tt", "h"]);

/** Every token must start some word of the candidate. */
function tokensMatch(tokens: string[], words: string[]): boolean {
  return tokens.every((t) =>
    words.some(
      (w) => w.startsWith(t) && (!TYPE_WORDS.has(w) || w === t || TYPE_ABBR.has(t))
    )
  );
}

const KIND_LIMIT: Record<LocationKind, number> = { city: 3, ward: 6, district: 3, building: 4 };

/**
 * Ranked suggestions for what the customer has typed so far, at most a few
 * per kind. Places that have available rooms come first (with their
 * count), then places in the city currently browsed, then shorter names.
 */
export function searchLocations(
  q: string,
  opts: { counts: LocationCounts; buildings: BuildingOption[]; currentCity?: string }
): LocationHit[] {
  const strict = rank(queryTokens(q), opts);
  if (strict.length > 0) return strict;
  // "phòng ở phú thuận" → retry as "phu thuan".
  const loose = queryTokens(q, true);
  return loose.length > 0 ? rank(loose, opts) : [];
}

function rank(
  tokens: string[],
  opts: { counts: LocationCounts; buildings: BuildingOption[]; currentCity?: string }
): LocationHit[] {
  if (tokens.length === 0) return [];
  index ??= buildIndex();
  const joined = tokens.join(" ");
  const countOf = (e: Entry) =>
    (e.kind === "city"
      ? opts.counts.city[e.countKey]
      : e.kind === "ward"
        ? opts.counts.ward[e.countKey]
        : opts.counts.district[e.countKey]) ?? 0;

  const hits: LocationHit[] = [];
  for (const e of index) {
    if (!tokensMatch(tokens, e.words)) continue;
    const count = countOf(e);
    // A ward/district matched only through its city ("ha noi" → every
    // Hanoi ward) is noise — keep it only if it has rooms ("hcm" → Phường
    // Phú Thuận · 5 phòng trống).
    if (count === 0 && e.kind !== "city") {
      const ownAll = tokensMatch(tokens, e.ownWords);
      // The whole query already names the city ("ha noi", "can tho") and
      // the ward's own name doesn't cover it → it's the city they want.
      const cityAll = tokensMatch(tokens, cityWordsOf(e.city));
      const ownAny = tokens.some((t) => e.ownWords.some((w) => w.startsWith(t)));
      if (!ownAny || (cityAll && !ownAll)) continue;
    }
    let score = 0;
    if (e.core === joined) score += 60; // "phu thuan" → exactly Phú Thuận
    else if (e.core.startsWith(joined)) score += 30;
    if (count > 0) score += 100 + Math.min(count, 50);
    if (opts.currentCity && e.city === opts.currentCity) score += 15;
    if (e.kind === "city") score += 10;
    score -= e.label.length / 100;
    hits.push({ kind: e.kind, label: e.label, sub: e.sub, query: e.query, count, score });
  }

  for (const b of opts.buildings) {
    const words = normalizeSearchText(`${b.name} ${b.address} ${b.ward}`).split(" ");
    if (!tokensMatch(tokens, words)) continue;
    hits.push({
      kind: "building",
      label: b.name,
      sub: b.ward || "Tòa nhà",
      query: `city=all&propertyId=${encodeURIComponent(b.id)}`,
      count: b.available,
      score: 200 + b.available,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  const perKind: Record<LocationKind, number> = { city: 0, ward: 0, district: 0, building: 0 };
  return hits.filter((h) => perKind[h.kind]++ < KIND_LIMIT[h.kind]);
}

/** What Enter picks: an exact name match ("phu thuan", "q7", "hcm"), else
 * the top suggestion if it has available rooms ("tp hcm", "quận 7"), else
 * null → free-text keyword search ("gần chợ Tân Mỹ"). */
export function enterLocationHit(q: string, hits: LocationHit[]): LocationHit | null {
  for (const dropFiller of [false, true]) {
    const hit = exactFor(queryTokens(q, dropFiller).join(" "), hits);
    if (hit) return hit;
  }
  return hits[0] && hits[0].count > 0 ? hits[0] : null;
}

function exactFor(raw: string, hits: LocationHit[]): LocationHit | null {
  // "p phu thuan", "phuong phu thuan", "tp ha noi" → compare without the type word.
  const joined = raw.replace(/^(p|x|q|tp|phuong|xa|quan|huyen|tinh|thanh pho)\s+/, "");
  if (!joined) return null;
  index ??= buildIndex();
  for (const h of hits) {
    if (h.kind === "building") {
      if (normalizeSearchText(h.label) === joined) return h;
      continue;
    }
    const e = index.find((x) => x.query === h.query);
    if (!e) continue;
    const aliases =
      e.kind === "city" ? cityAliases(e.label) : e.kind === "district" ? districtAliases(e.countKey) : [];
    if (e.core === joined || normalizeSearchText(e.label) === joined || aliases.includes(joined)) return h;
  }
  return null;
}
