import { NextRequest, NextResponse } from "next/server";
import { setRoomStatus } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import { ROOM_STATUSES, type RoomStatus } from "@/types";

type Params = { params: Promise<{ id: string }> };

// Dedicated fast-path endpoint for the 1-click status change admins do most often.
export async function PUT(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status as RoomStatus | undefined;

  if (!status || !(ROOM_STATUSES as string[]).includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const room = await setRoomStatus(id, status);
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ room });
}
