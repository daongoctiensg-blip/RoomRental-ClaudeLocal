import { NextRequest, NextResponse } from "next/server";
import { setRoomStatus } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import { ROOM_STATUSES, type RoomStatus } from "@/types";

type Params = { params: Promise<{ id: string }> };

// Plain manual status change — only for transitions with no money attached
// (available <-> renovating, or an admin correcting a mistake). setRoomStatus
// itself rejects "deposited"/"sold" with a helpful error pointing at the
// dedicated endpoints below.
export async function PUT(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status as RoomStatus | undefined;

  if (!status || !(ROOM_STATUSES as string[]).includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const result = await setRoomStatus(id, status);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ room: result });
}
