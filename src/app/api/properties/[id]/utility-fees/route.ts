import { NextRequest, NextResponse } from "next/server";
import { addUtilityFeeVersion } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import type { UtilityFeeVersion } from "@/types";

type Params = { params: Promise<{ id: string }> };

// Utility fees are append-only (versioned): this endpoint only adds a new
// version, it never edits/removes a past one, so old tenant agreements keep
// referring to the rate that was actually in effect when they signed.
export async function POST(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Omit<
    UtilityFeeVersion,
    "id"
  > | null;

  if (
    !body ||
    typeof body.electricityPricePerKwh !== "number" ||
    typeof body.waterPricePerPerson !== "number" ||
    typeof body.serviceFeePerMonth !== "number" ||
    !body.effectiveFrom ||
    (body.waterFeeMode !== undefined &&
      body.waterFeeMode !== "per_person" &&
      body.waterFeeMode !== "per_m3")
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const property = await addUtilityFeeVersion(id, body);
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ property });
}
