// Customer-side room filters — round 13 (mobile). Client-safe, no DB.
//
// Why this exists: the mobile "Lọc theo" screen shows how many rooms match
// EACH option ("Máy lạnh (5)") and a live "Xem kết quả (N)" button that
// updates while the customer is still ticking boxes — before anything is
// submitted. That needs the exact same matching logic on the client as on
// the server, so it lives here once:
//   - the homepage (server) loads the rooms for the chosen location, then
//     applies matchesFilters() to build the list;
//   - the same rooms, reduced to a tiny public FacetRoom shape, go to the
//     mobile filter screen, which reruns matchesFilters() on every tick.
// Location (city/ward/district/address/near/propertyId) and sort stay in
// SQL / listRooms() — they change which rooms are candidates at all.
import { PRICE_BUCKETS } from "@/lib/priceBuckets";
import { ROOM_STATUSES, type RoomStatus, type RoomWithProperty } from "@/types";
import { effectiveAmenities, normalizeAmenityName } from "@/lib/amenities";

/** The only room fields the filters need — all already public. */
export interface FacetRoom {
  status: RoomStatus;
  price: number;
  occupancy: number | null;
  balcony: boolean;
  /** Normalized effective amenity names (see effectiveAmenities). */
  amenityKeys: string[];
}

export interface FilterState {
  statuses: RoomStatus[];
  /** VND, inclusive. 0 = no lower bound. */
  priceMin: number;
  /** VND, exclusive (same as the SQL filter this replaced). null = no upper bound. */
  priceMax: number | null;
  occupancy: 1 | 2 | 3 | null;
  amenities: string[];
  balcony: boolean;
}

export type FilterDimension = "status" | "price" | "occupancy" | "amenities" | "balcony";

export const DEFAULT_STATUSES: RoomStatus[] = ["available"];

type Getter = (key: string) => string | null | undefined;

/** Reads the filter part of the URL. Defaults match the site's behavior
 * since round 1: only "Còn trống" rooms unless the visitor opts in. */
export function parseFilterState(get: Getter): FilterState {
  const statusParam = get("status");
  const statuses = statusParam
    ? statusParam.split(",").filter((s): s is RoomStatus => (ROOM_STATUSES as string[]).includes(s))
    : DEFAULT_STATUSES;

  let priceMin = 0;
  let priceMax: number | null = null;
  const minP = get("priceMin");
  const maxP = get("priceMax");
  if (minP != null || maxP != null) {
    const a = minP != null ? Number(minP) : 0;
    const b = maxP != null ? Number(maxP) : NaN;
    priceMin = Number.isFinite(a) && a > 0 ? a : 0;
    priceMax = Number.isFinite(b) ? b : null;
  } else {
    // Links shared before the slider existed used ?priceBucket=<key>.
    const bucket = PRICE_BUCKETS.find((x) => x.key === get("priceBucket"));
    if (bucket) {
      priceMin = bucket.min;
      priceMax = bucket.max;
    }
  }

  const occ = get("occupancy");
  const occupancy = occ === "1" || occ === "2" || occ === "3" ? (Number(occ) as 1 | 2 | 3) : null;
  const amenities = (get("amenities") ?? "").split(",").filter(Boolean);
  return { statuses, priceMin, priceMax, occupancy, amenities, balcony: get("balcony") === "1" };
}

/** Writes the filter part back onto URL params (clearing what's unset). */
export function writeFilterState(params: URLSearchParams, s: FilterState): void {
  const isDefaultStatus =
    s.statuses.length === DEFAULT_STATUSES.length &&
    s.statuses.every((x) => DEFAULT_STATUSES.includes(x));
  if (isDefaultStatus) params.delete("status");
  else params.set("status", s.statuses.join(","));
  params.delete("priceBucket");
  if (s.priceMin > 0) params.set("priceMin", String(s.priceMin));
  else params.delete("priceMin");
  if (s.priceMax !== null) params.set("priceMax", String(s.priceMax));
  else params.delete("priceMax");
  if (s.occupancy) params.set("occupancy", String(s.occupancy));
  else params.delete("occupancy");
  if (s.amenities.length) params.set("amenities", s.amenities.join(","));
  else params.delete("amenities");
  if (s.balcony) params.set("balcony", "1");
  else params.delete("balcony");
}

/** Number of filter groups that differ from the defaults — the badge on the
 * mobile "Bộ lọc (N)" button. */
export function countActiveFilters(s: FilterState): number {
  let n = 0;
  if (!(s.statuses.length === 1 && s.statuses[0] === "available")) n++;
  if (s.priceMin > 0 || s.priceMax !== null) n++;
  if (s.occupancy) n++;
  n += s.amenities.length;
  if (s.balcony) n++;
  return n;
}

/** Does this room pass every active filter? `skip` ignores one dimension —
 * used to count options within that dimension ("how many rooms would match
 * if I also picked 6-8 triệu", given everything else already chosen). */
export function matchesFilters(r: FacetRoom, s: FilterState, skip?: FilterDimension): boolean {
  if (skip !== "status" && s.statuses.length > 0 && !s.statuses.includes(r.status)) return false;
  if (skip !== "price") {
    if (r.price < s.priceMin) return false;
    if (s.priceMax !== null && r.price >= s.priceMax) return false;
  }
  if (skip !== "occupancy" && s.occupancy) {
    if (r.occupancy == null) return false;
    if (s.occupancy === 3 ? r.occupancy < 3 : r.occupancy !== s.occupancy) return false;
  }
  if (skip !== "amenities" && s.amenities.length) {
    const have = new Set(r.amenityKeys);
    if (!s.amenities.every((a) => have.has(normalizeAmenityName(a)))) return false;
  }
  if (skip !== "balcony" && s.balcony && !r.balcony) return false;
  return true;
}

/** Parses ?near=lat,lng ("Phòng gần vị trí của tôi"). Rejects anything
 * that isn't a plausible coordinate pair. */
export function parseNear(value: string | null | undefined): { lat: number; lng: number } | null {
  if (!value) return null;
  const [a, b] = value.split(",").map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: a, lng: b };
}

/** Reduces a full room to the public facet shape sent to the browser. */
export function toFacetRoom(r: RoomWithProperty): FacetRoom {
  return {
    status: r.status,
    price: r.priceMonthly,
    occupancy: r.maxOccupancy ?? null,
    balcony: r.hasBalcony,
    amenityKeys: effectiveAmenities(r, r.property.amenitiesShared).map(normalizeAmenityName),
  };
}
