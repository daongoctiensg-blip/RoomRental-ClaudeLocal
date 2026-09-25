import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { ensureAmenity, listAmenitiesWithUsage } from "@/lib/amenityCatalog";
import { isAmenityGroupKey, isAmenityIconKey } from "@/lib/amenities";

// Amenity master data — round 12. Admin-only: the public site reads the
// catalog server-side (listAmenities) and never needs this endpoint.
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json({ amenities: await listAmenitiesWithUsage() });
}

/** Create-if-missing. Used by the admin amenity picker's type-and-Enter: if
 * the name already exists (case/diacritics-insensitive) the existing item is
 * returned instead of a duplicate being created. */
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    group?: unknown;
    icon?: unknown;
    isPopular?: unknown;
  } | null;
  if (!body || typeof body.name !== "string") {
    return NextResponse.json({ error: "Thiếu tên tiện ích." }, { status: 400 });
  }
  const res = await ensureAmenity(body.name, {
    group: isAmenityGroupKey(body.group) ? body.group : undefined,
    icon: isAmenityIconKey(body.icon) ? body.icon : undefined,
    isPopular: body.isPopular === true,
  });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res, { status: res.created ? 201 : 200 });
}
