// Amenity master data ("danh mục tiện ích") — round 12. Client-safe: pure
// types/constants/helpers only, no DB access (that lives in
// src/lib/amenityCatalog.ts, server-only).
//
// Design decision: Property.amenitiesShared / Room.amenitiesOverride keep
// storing amenity NAMES (string[]), exactly as before — not catalog ids.
// Every display path (room card tags, detail page, PDF export, search,
// AI 2 parity) keeps working unchanged. What changes is the invariant: every
// name saved on a property/room is canonicalized against the catalog first
// (see canonicalizeAmenityNames in amenityCatalog.ts) — so "may lanh" typed
// by an admin is stored as the catalog's "Máy lạnh", and a brand-new name is
// added to the catalog automatically. Renaming a catalog item rewrites it
// everywhere it's used (renameAmenity), so names never drift apart.

export type AmenityGroupKey =
  | "furniture"
  | "appliances"
  | "bathroom"
  | "building"
  | "services"
  | "security"
  | "other";

export const AMENITY_GROUPS: { key: AmenityGroupKey; label: string }[] = [
  { key: "furniture", label: "Nội thất" },
  { key: "appliances", label: "Thiết bị" },
  { key: "bathroom", label: "Phòng tắm & vệ sinh" },
  { key: "building", label: "Tiện ích tòa nhà" },
  { key: "services", label: "Dịch vụ" },
  { key: "security", label: "An ninh" },
  { key: "other", label: "Khác" },
];

export const AMENITY_GROUP_LABEL: Record<AmenityGroupKey, string> = Object.fromEntries(
  AMENITY_GROUPS.map((g) => [g.key, g.label])
) as Record<AmenityGroupKey, string>;

export function isAmenityGroupKey(v: unknown): v is AmenityGroupKey {
  return typeof v === "string" && AMENITY_GROUPS.some((g) => g.key === v);
}

/** Fixed set of icon keys an admin can pick from (rendered by
 * <AmenityIcon>). A fixed list — not free text — so a typo can never produce
 * a broken icon. */
export const AMENITY_ICON_OPTIONS: { key: string; label: string }[] = [
  { key: "check", label: "Dấu tích (mặc định)" },
  { key: "air-vent", label: "Máy lạnh" },
  { key: "thermometer", label: "Nóng lạnh" },
  { key: "refrigerator", label: "Tủ lạnh" },
  { key: "washing-machine", label: "Máy giặt" },
  { key: "elevator", label: "Thang máy" },
  { key: "parking", label: "Chỗ để xe" },
  { key: "wifi", label: "Wifi" },
  { key: "cooking-pot", label: "Bếp" },
  { key: "bed", label: "Giường" },
  { key: "sofa", label: "Bàn ghế / sofa" },
  { key: "shirt", label: "Tủ quần áo" },
  { key: "bath", label: "Phòng tắm / WC" },
  { key: "tv", label: "TV" },
  { key: "shield", label: "An ninh / bảo vệ" },
  { key: "camera", label: "Camera" },
  { key: "key", label: "Khóa / tự do giờ giấc" },
  { key: "sparkles", label: "Dọn dẹp" },
  { key: "sun", label: "Ban công / cửa sổ" },
  { key: "dog", label: "Thú cưng" },
];

export function isAmenityIconKey(v: unknown): v is string {
  return typeof v === "string" && AMENITY_ICON_OPTIONS.some((o) => o.key === v);
}

export interface Amenity {
  id: string;
  name: string;
  group: AmenityGroupKey;
  icon: string;
  /** Shown as a checkbox in the homepage "Tiện ích phổ biến" filter, and
   * eligible for the quick tags on room cards / the icon strip on the
   * detail page. */
  isPopular: boolean;
  sortOrder: number;
}

/** Amenity + how many properties/rooms currently use it (admin page only). */
export interface AmenityWithUsage extends Amenity {
  usageCount: number;
}

/** Comparison key: case-, diacritics- and whitespace-insensitive, so
 * "Máy lạnh", "may lanh" and "MÁY  LẠNH" are the same amenity. "đ" is not
 * decomposed by NFD, so it's mapped by hand. */
export function normalizeAmenityName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Display form of a freshly typed name: trimmed, single-spaced, first
 * letter upper-cased ("  wc riêng " -> "Wc riêng"). Only applied to names
 * that don't already exist in the catalog — an existing item always keeps
 * the catalog's own spelling. */
export function cleanAmenityLabel(name: string): string {
  const s = name.replace(/\s+/g, " ").trim();
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase("vi-VN") + s.slice(1);
}

/** Splits one legacy free-text amenity line into individual items — used
 * once, by the migration that introduces the catalog. A line like "Đầy đủ
 * nội thất: tủ lạnh, máy lạnh, máy giặt" has a heading before the colon that
 * is not itself an amenity, so only the part after the colon is kept. */
export function splitLegacyAmenityLine(line: string): string[] {
  const afterColon = line.includes(":") ? line.slice(line.indexOf(":") + 1) : line;
  return afterColon
    .split(/[,;]/)
    .map((s) => cleanAmenityLabel(s))
    .filter((s) => s.length > 0);
}

/** Best-effort group for items created by the one-time legacy migration, so
 * the grouped amenity drawer doesn't start out with everything under
 * "Khác". Items an admin creates later by typing + Enter go to "Khác" (as
 * agreed with the owner) and can be re-grouped on the admin page. */
export function guessAmenityGroup(name: string): AmenityGroupKey {
  const n = normalizeAmenityName(name);
  const has = (...words: string[]) => words.some((w) => n.includes(w));
  if (has("wc", "toilet", "tam", "ve sinh", "bon cau", "lavabo")) return "bathroom";
  if (has("bao ve", "camera", "an ninh", "van tay", "khoa tu")) return "security";
  if (has("thang may", "xe", "san phoi", "ban cong", "san thuong", "wifi", "internet"))
    return "building";
  if (has("don ", "don phong", "giat ui", "ve sinh chung", "rac")) return "services";
  if (has("may lanh", "dieu hoa", "nong lanh", "tu lanh", "may giat", "bep", "tv", "tivi", "quat"))
    return "appliances";
  if (has("giuong", "tu ", "ban ", "ghe", "nem", "sofa", "ke ", "rem")) return "furniture";
  return "other";
}

/** Default catalog created by the migration. The first 8 are the same
 * keywords the homepage filter has used since round 10, kept as "phổ biến"
 * so the filter looks identical on day one. */
export const DEFAULT_AMENITIES: Omit<Amenity, "id" | "sortOrder">[] = [
  { name: "Máy lạnh", group: "appliances", icon: "air-vent", isPopular: true },
  { name: "Nóng lạnh", group: "appliances", icon: "thermometer", isPopular: true },
  { name: "Tủ lạnh", group: "appliances", icon: "refrigerator", isPopular: true },
  { name: "Máy giặt", group: "appliances", icon: "washing-machine", isPopular: true },
  { name: "Thang máy", group: "building", icon: "elevator", isPopular: true },
  { name: "Chỗ để xe", group: "building", icon: "parking", isPopular: true },
  { name: "Wifi", group: "building", icon: "wifi", isPopular: true },
  { name: "Bếp", group: "appliances", icon: "cooking-pot", isPopular: true },
  { name: "Giường", group: "furniture", icon: "bed", isPopular: false },
  { name: "Tủ quần áo", group: "furniture", icon: "shirt", isPopular: false },
  { name: "Bàn ghế", group: "furniture", icon: "sofa", isPopular: false },
  { name: "WC riêng", group: "bathroom", icon: "bath", isPopular: false },
];

/** Lookup map by normalized name — what every display path uses to find an
 * amenity's icon/group from the plain name stored on a property/room. */
export function buildAmenityLookup(catalog: Amenity[]): Map<string, Amenity> {
  return new Map(catalog.map((a) => [normalizeAmenityName(a.name), a]));
}

/** AND semantics for the homepage filter: the room must have every checked
 * amenity. Exact (normalized) match against the catalog names stored on the
 * room — no more substring guessing now that names are canonical. */
export function roomHasAllAmenities(roomAmenities: string[], selected: string[]): boolean {
  const have = new Set(roomAmenities.map(normalizeAmenityName));
  return selected.every((s) => have.has(normalizeAmenityName(s)));
}

/** An amenity name as shown on a public page, with its catalog metadata. */
export interface DisplayAmenity {
  name: string;
  icon: string;
  group: AmenityGroupKey;
  isPopular: boolean;
}

/** Resolves the plain names stored on a room/property against the catalog
 * (keeps the stored order). A name that somehow isn't in the catalog still
 * shows, with the default icon under "Khác" — nothing is ever dropped. */
export function resolveAmenities(names: string[], catalog: Amenity[]): DisplayAmenity[] {
  const lookup = buildAmenityLookup(catalog);
  const seen = new Set<string>();
  const out: DisplayAmenity[] = [];
  for (const name of names) {
    const key = normalizeAmenityName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const a = lookup.get(key);
    out.push({
      name: a?.name ?? name,
      icon: a?.icon ?? "check",
      group: a?.group ?? "other",
      isPopular: a?.isPopular ?? false,
    });
  }
  return out;
}

export interface AmenityGroupDisplay {
  key: AmenityGroupKey;
  label: string;
  items: DisplayAmenity[];
}

/** Groups resolved amenities in AMENITY_GROUPS order, skipping empty groups
 * — powers the grouped "Tất cả tiện nghi" drawer and tab. */
export function groupAmenities(list: DisplayAmenity[]): AmenityGroupDisplay[] {
  return AMENITY_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    items: list.filter((a) => a.group === g.key),
  })).filter((g) => g.items.length > 0);
}
