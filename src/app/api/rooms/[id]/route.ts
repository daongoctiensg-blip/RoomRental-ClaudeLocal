import { NextRequest, NextResponse } from "next/server";
import { deactivateRoom, getRoom, updateRoom, type RoomInput } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const room = await getRoom(id);
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ room });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Partial<RoomInput> | null;
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const room = await updateRoom(id, body);
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
