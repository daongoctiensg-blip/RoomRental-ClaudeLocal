import { NextRequest, NextResponse } from "next/server";
import { listRoomEvents } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";

type Params = { params: Promise<{ id: string }> };

// GET /api/rooms/[id]/events — full history timeline for one room
// (status changes, deposits, cancellations, expirations, signed contracts).
// Admin-only: cancellation/commission amounts must never reach customers.
export async function GET(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const events = await listRoomEvents(id);
  return NextResponse.json({ events });
}
