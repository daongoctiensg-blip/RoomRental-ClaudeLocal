import { NEARBY_RADIUS_KM, haversineDistanceKm } from "@/lib/geocode";
import type { RoomWithProperty } from "@/types";

/** Customer-safe summary of a nearby room — only fields already public on
 * every room card (no landlord/commission/internal data can ride along). */
export interface NearbyRoom {
  id: string;
  code: string;
  floor?: string;
  areaSqm: number;
  priceMonthly: number;
  image?: string;
  propertyName: string;
  /** 0 for rooms in the same building. */
  distanceKm: number;
  sameBuilding: boolean;
}

export const NEARBY_LIMIT = 6;

/**
 * "Phòng gần đây" — round 12, replacing trip.com's "Xem xung quanh đây"
 * (nearby points of interest, which this site has no data for) with the
 * owner's own idea: other AVAILABLE rooms within NEARBY_RADIUS_KM (2 km —
 * the same radius the homepage's nearby search already uses), reusing the
 * existing haversine distance code. Coordinates live on the property, so
 * rooms in the same building are 0 m away: agreed with the owner to show
 * them in the same list, first, labeled "Cùng tòa nhà". Then other
 * buildings by distance, then cheaper first on ties. A property without
 * coordinates can only contribute same-building rooms.
 */
export function findNearbyRooms(
  current: RoomWithProperty,
  candidates: RoomWithProperty[]
): NearbyRoom[] {
  const origin =
    current.property.lat != null && current.property.lng != null
      ? { lat: current.property.lat, lng: current.property.lng }
      : null;

  const out: NearbyRoom[] = [];
  for (const r of candidates) {
    if (r.id === current.id || r.status !== "available" || !r.isActive || !r.property.isActive) {
      continue;
    }
    const sameBuilding = r.propertyId === current.propertyId;
    let distanceKm = 0;
    if (!sameBuilding) {
      if (!origin || r.property.lat == null || r.property.lng == null) continue;
      distanceKm = haversineDistanceKm(origin, { lat: r.property.lat, lng: r.property.lng });
      if (distanceKm > NEARBY_RADIUS_KM) continue;
    }
    out.push({
      id: r.id,
      code: r.code,
      floor: r.floor,
      areaSqm: r.areaSqm,
      priceMonthly: r.priceMonthly,
      image: r.images[0],
      propertyName: r.property.name,
      distanceKm,
      sameBuilding,
    });
  }
  out.sort(
    (a, b) =>
      Number(b.sameBuilding) - Number(a.sameBuilding) ||
      a.distanceKm - b.distanceKm ||
      a.priceMonthly - b.priceMonthly
  );
  return out.slice(0, NEARBY_LIMIT);
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}
