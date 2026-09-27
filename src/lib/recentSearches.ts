// "Tìm kiếm gần đây" on the mobile search screen — round 13. Kept only in
// this browser (localStorage), like saved rooms; every access is guarded so
// private mode / blocked storage just means an empty list.
const KEY = "phongchothue:recentSearches";
const MAX = 6;

export interface RecentSearch {
  title: string;
  sub: string;
  /** Homepage query string (without "?") this entry re-opens. */
  query: string;
}

export function getRecentSearches(): RecentSearch[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is RecentSearch =>
        x && typeof x.title === "string" && typeof x.sub === "string" && typeof x.query === "string"
    );
  } catch {
    return [];
  }
}

export function addRecentSearch(entry: RecentSearch): void {
  try {
    const next = [entry, ...getRecentSearches().filter((x) => x.query !== entry.query)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore — storage unavailable
  }
}

export function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
