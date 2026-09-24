import { NextRequest, NextResponse } from "next/server";
import { getRoom, getProperty, calculateCommission } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";

// GET /api/commissions/preview?roomId=...&contractDurationMonths=...&signDate=YYYY-MM-DD
// Admin-only, PREVIEW ONLY — round 10, §18. Reuses the exact same
// calculateCommission() (and the same bonus validFrom/validTo window check
// signContract() itself uses) so the number shown here is guaranteed to
// match what signContract() would actually charge, but this endpoint never
// writes to the database or creates any contract/event record — it's a
// what-if calculator for a sale rep to check before committing to anything.
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId");
  const months = Number(searchParams.get("contractDurationMonths"));
  const signDate = searchParams.get("signDate") || new Date().toISOString().slice(0, 10);

  if (!roomId || !Number.isFinite(months) || months <= 0) {
    return NextResponse.json(
      { error: "Thiếu phòng hoặc số tháng hợp đồng không hợp lệ" },
      { status: 400 }
    );
  }

  const room = await getRoom(roomId);
  if (!room) return NextResponse.json({ error: "Không tìm thấy phòng" }, { status: 404 });

  const property = await getProperty(room.propertyId);
  if (!property) return NextResponse.json({ error: "Không tìm thấy nhà" }, { status: 404 });

  const commission = calculateCommission(room.priceMonthly, months, property.commissionPolicy);
  if ("error" in commission) {
    return NextResponse.json({ error: commission.error }, { status: 400 });
  }

  const bonus = property.saleBonusPolicy;
  const bonusApplicable = !!bonus && signDate >= bonus.validFrom && signDate <= bonus.validTo;
  const bonusAmount = bonusApplicable ? bonus!.amount : 0;

  return NextResponse.json({
    roomCode: room.code,
    propertyName: property.name,
    priceMonthly: room.priceMonthly,
    contractDurationMonths: months,
    commissionPercent: commission.commissionPercent,
    commissionAmount: commission.commissionAmount,
    bonusApplicable,
    bonusAmount,
    bonusDescription: bonus?.description ?? null,
    totalSaleEarnings: commission.commissionAmount + bonusAmount,
  });
}
