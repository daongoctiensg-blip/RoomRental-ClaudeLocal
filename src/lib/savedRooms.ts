// "Lưu" (favorite) rooms — round 12. Stored only in the visitor's own
// browser (localStorage): no account needed, nothing sent to the server
// except when the visitor opens their saved list (/?saved=id1,id2).
// Every access is wrapped in try/catch — localStorage can throw or be
// unavailable (private mode, blocked storage), and the site must keep
// working normally without it.
const KEY = "phongchothue:savedRooms";
const EVENT = "saved-rooms-changed";

export function getSavedRoomIds(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function isRoomSaved(id: string): boolean {
  return getSavedRoomIds().includes(id);
}

/** Returns the new saved state. */
export function toggleSavedRoom(id: string): boolean {
  const current = getSavedRoomIds();
  const saved = !current.includes(id);
  const next = saved ? [id, ...current] : current.filter((x) => x !== id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next.slice(0, 100)));
  } catch {
    // Storage unavailable — the heart just won't persist; nothing breaks.
  }
  window.dispatchEvent(new Event(EVENT));
  return saved;
}

/** Re-run `cb` whenever the saved list changes — in this tab (custom event)
 * or another tab (the native `storage` event). Returns an unsubscribe fn. */
export function onSavedRoomsChange(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}
