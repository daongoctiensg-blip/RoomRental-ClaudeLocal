// Vietnamese-aware free-text location search. Customers type natural,
// conversational sentences into the search box — "tôi muốn nhà ở quận 7",
// "phòng gần đường Phú Thuận" — rather than an exact address fragment. A
// plain "does the address contain this whole sentence" check (the previous
// behaviour) fails on both of those. This module strips diacritics and
// conversational filler words so a loose, order-independent keyword match
// still finds the right rooms.

// Small, deliberately conservative list: words that only ever add "I want /
// near / area / for rent" noise around a real location, never part of a
// location name itself in this dataset (addressNew/addressOld are
// ward/district based, no street-level field). "khu" is a rare exception —
// it's filler in "khu vực" but also literally starts "Khu phố 2" in the seed
// address — kept on the list anyway since stripping it still leaves enough
// of the real location behind to match (see search.test.ts-style examples
// in the PR description).
const FILLER_WORDS = new Set([
  "toi",
  "minh",
  "em",
  "anh",
  "chi",
  "muon",
  "can",
  "tim",
  "kiem",
  "cho",
  "thue",
  "phong",
  "nha",
  "o",
  "tai",
  "gan",
  "duong",
  "khu",
  "vuc",
  "co",
  "loai",
  "kieu",
  "xin",
  "giup",
  "nhe",
  "a",
  "the",
  "mot",
  "cai",
  "voi",
  "va",
  "hay",
  "hoac",
  "la",
  "day",
  "nay",
  "nhu",
]);

/** Lowercase, strip Vietnamese diacritics, and collapse punctuation to
 * spaces — so "Phú Thuận" / "phu thuan" / "PHÚ THUẬN," all normalize the
 * same way and can be compared directly. */
export function normalizeSearchText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining diacritic marks
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract the meaningful keywords from a free-text search query: normalize,
 * then drop conversational filler so "tôi muốn nhà ở quận 7" becomes just
 * ["quan", "7"]. Returns [] if the query was nothing but filler — callers
 * should treat that as "no location filter" rather than matching everything
 * or nothing literally. */
export function extractSearchKeywords(query: string): string[] {
  return normalizeSearchText(query)
    .split(" ")
    .filter((token) => token.length > 0 && !FILLER_WORDS.has(token));
}

/** True if every keyword appears somewhere in the target text — order
 * independent, diacritics-insensitive. Used with AND semantics (all
 * keywords must be present) so a multi-word query narrows results rather
 * than broadening them. */
export function matchesKeywords(targetText: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const normalizedTarget = normalizeSearchText(targetText);
  return keywords.every((kw) => normalizedTarget.includes(kw));
}
