// Round 15 — what an unauthenticated visitor may see. A guest sees ONLY
// rooms that are "Còn trống" (available), and only buildings that currently
// have at least one of them. Đã cọc / Đã cho thuê / Đang sửa chữa rooms are
// hidden everywhere public: homepage, saved list, direct room links, PDF
// export and the public JSON API. A logged-in admin keeps seeing everything.
// Every check is done on the server; hiding a button is never enough.
import type { Room, RoomWithProperty } from "@/types";

export const PUBLIC_STATUSES = ["available"] as const;

/** Can a guest see this room at all? */
export function isRoomPublic(room: Pick<Room, "status" | "isActive"> & { property: { isActive: boolean } }): boolean {
  return room.isActive && room.property.isActive && room.status === "available";
}

/** Property ids that have ≥ 1 publicly visible room. */
export function publicPropertyIds(rooms: RoomWithProperty[]): Set<string> {
  return new Set(rooms.filter(isRoomPublic).map((r) => r.propertyId));
}
