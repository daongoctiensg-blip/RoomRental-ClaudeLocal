import { NextRequest, NextResponse } from "next/server";
import { signContract } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";

type Params = { params: Promise<{ id: string }> };

// POST /api/rooms/[id]/contract — "Chốt hợp đồng". Body: { contractDurationMonths }.
// Looks up the matching commission tier, checks whether today falls inside
// the active "lì xì" bonus window, and returns both computed amounts.
export async function POST(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const contractDurationMonths = Number(body?.contractDurationMonths);

  if (!Number.isFinite(contractDurationMonths) || contractDurationMonths <= 0) {
    return NextResponse.json({ error: "Thiếu thời hạn hợp đồng (số tháng)." }, { status: 400 });
  }

  const result = await signContract(id, contractDurationMonths);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
