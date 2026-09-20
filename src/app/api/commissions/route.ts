import { NextRequest, NextResponse } from "next/server";
import { listAllEvents, listProperties, listRooms } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";

// GET /api/commissions — every contract_signed / deposit_cancelled event
// across all rooms, enriched with room/property labels, plus running totals.
// This is the data behind the admin "Hoa hồng & lì xì" report. Admin-only.
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const [events, rooms, properties] = await Promise.all([
    listAllEvents(),
    // includeInactiveProperties: a room on a now-unlisted property still had
    // real transactions — they must not disappear from this report just
    // because the property was later unlisted (not deleted) from the site.
    listRooms(undefined, { includeInactiveProperties: true }),
    listProperties({ includeInactive: true }),
  ]);

  const roomsById = new Map(rooms.map((r) => [r.id, r]));
  const propertiesById = new Map(properties.map((p) => [p.id, p]));

  const relevant = events.filter(
    (e) => e.type === "contract_signed" || e.type === "deposit_cancelled"
  );

  const enriched = relevant.map((e) => {
    const room = roomsById.get(e.roomId);
    const property = room ? propertiesById.get(room.propertyId) : undefined;
    return {
      ...e,
      roomCode: room?.code ?? "(phòng đã xoá)",
      propertyName: property?.name ?? "",
    };
  });

  const totalCommission = enriched.reduce(
    (sum, e) => sum + (e.contract?.commissionAmount ?? 0),
    0
  );
  const totalBonus = enriched.reduce(
    (sum, e) => sum + (e.contract?.bonusAmount ?? 0),
    0
  );
  const totalCancellationSaleShare = enriched.reduce(
    (sum, e) => sum + (e.cancellation?.saleTotal ?? 0),
    0
  );

  return NextResponse.json({
    events: enriched,
    totals: {
      commission: totalCommission,
      bonus: totalBonus,
      cancellationSaleShare: totalCancellationSaleShare,
    },
  });
}
