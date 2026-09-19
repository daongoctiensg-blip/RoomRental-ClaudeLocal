import { NextRequest, NextResponse } from "next/server";
import { startDeposit } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";

type Params = { params: Promise<{ id: string }> };

// POST /api/rooms/[id]/deposit — "Nhận cọc giữ phòng". Snapshots the
// property's current hold-amount/hold-days onto the room and starts the
// countdown from this exact moment.
export async function POST(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const result = await startDeposit(id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ room: result });
}
