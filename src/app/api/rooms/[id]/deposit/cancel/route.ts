import { NextRequest, NextResponse } from "next/server";
import { cancelDeposit } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";

type Params = { params: Promise<{ id: string }> };

// POST /api/rooms/[id]/deposit/cancel — customer actively backs out before
// the hold period runs out on its own. Computes the day-prorated
// landlord/sale settlement server-side (see calculateCancellationSettlement)
// and returns it so the admin UI can show exactly what each side gets.
export async function POST(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const result = await cancelDeposit(id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
