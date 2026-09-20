import { NextRequest, NextResponse } from "next/server";
import {
  deactivateRoom,
  getRoom,
  toPublicRoom,
  updateRoom,
  type RoomInput,
} from "@/lib/db";
import { isAdminRequest, requireAdmin } from "@/lib/apiAuth";

type Params = { params: Promise<{ id: string }> };

// Public endpoint — same sanitization rule as GET /api/rooms.
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const room = await getRoom(id);
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const admin = isAdminRequest(request);
  // Same rule as the public /rooms/[id] page: a deactivated room, or a room
  // on a deactivated property, must be as unreachable as a missing id for a
  // non-admin caller — this REST endpoint is a separate code path from that
  // page and needs the same check independently.
  if (!admin && (!room.isActive || !room.property.isActive)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ room: admin ? room : toPublicRoom(room) });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | (Partial<RoomInput> & { status?: unknown; currentDeposit?: unknown })
    | null;
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  // status/currentDeposit are never editable through this generic endpoint —
  // they must go through /deposit, /deposit/cancel, /contract or /status so
  // the money math and history log stay correct.
  const { status: _status, currentDeposit: _currentDeposit, ...safeBody } = body;

  const room = await updateRoom(id, safeBody);
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ room });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const ok = await deactivateRoom(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
