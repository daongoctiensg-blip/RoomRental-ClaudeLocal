// Parses a map position typed or pasted by an admin — round 14. Accepts
// "10.7339, 106.7191" (what Google Maps copies on right-click) and common
// Google Maps / OpenStreetMap URL shapes. Returns null if nothing usable.
export function parseCoordinates(raw: string): { lat: number; lng: number } | null {
  const text = raw.trim();
  if (!text) return null;
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // Google place URL (exact pin)
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, // Google "@lat,lng,zoom"
    /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i,
    /[?&]mlat=(-?\d+(?:\.\d+)?)&mlon=(-?\d+(?:\.\d+)?)/, // openstreetmap.org
    /#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/, // openstreetmap.org
    /^(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)$/, // plain "lat, lng"
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

export function formatCoordinates(lat?: number | null, lng?: number | null): string {
  return lat != null && lng != null ? `${lat}, ${lng}` : "";
}
