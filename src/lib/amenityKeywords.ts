// "Tiện ích phổ biến" checkbox filter — round 10, §12. Deliberately NOT a
// schema change: amenities are still just free-text strings on
// Property.amenitiesShared / Room.amenitiesOverride (see src/types/index.ts).
// This is a fixed list of common keywords matched against that free text
// (case/diacritics-insensitive substring match, see amenityMatches below), so
// a landlord typing "Máy lạnh 2 chiều, wifi tốc độ cao" still matches the
// "Máy lạnh" and "Wifi" checkboxes without any data migration.
export const COMMON_AMENITY_KEYWORDS = [
  "Máy lạnh",
  "Nóng lạnh",
  "Tủ lạnh",
  "Máy giặt",
  "Thang máy",
  "Chỗ để xe",
  "Wifi",
  "Bếp",
] as const;

export type CommonAmenityKeyword = (typeof COMMON_AMENITY_KEYWORDS)[number];

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** True if `amenities` (the room's effective amenity list) contains a
 * substring match for `keyword`, ignoring case and Vietnamese diacritics —
 * so "may lanh" (as typed by a customer, or a landlord without dấu) still
 * matches "Máy lạnh". */
export function amenityListMatches(amenities: string[], keyword: string): boolean {
  const needle = normalize(keyword);
  return amenities.some((a) => normalize(a).includes(needle));
}

/** AND semantics: a room must match every keyword the customer checked
 * (checking both "Máy lạnh" and "Wifi" means "has both", not "has either") —
 * this is what customers expect from a filter checklist. */
export function roomMatchesAllAmenityKeywords(
  amenities: string[],
  selectedKeywords: string[]
): boolean {
  return selectedKeywords.every((k) => amenityListMatches(amenities, k));
}
