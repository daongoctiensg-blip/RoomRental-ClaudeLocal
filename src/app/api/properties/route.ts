import { NextRequest, NextResponse } from "next/server";
import { createProperty, listProperties, toPublicProperty, type PropertyInput } from "@/lib/db";
import { isAdminRequest, requireAdmin } from "@/lib/apiAuth";

// Public endpoint — non-admin callers only get the customer-safe shape
// (no commission %, no landlord contact, no "lì xì").
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";
  const properties = await listProperties({ includeInactive });
  const admin = isAdminRequest(request);
  return NextResponse.json({
    properties: admin ? properties : properties.map(toPublicProperty),
  });
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as PropertyInput | null;
  if (!body || !body.name || !body.addressNew) {
    return NextResponse.json({ error: "Invalid property payload" }, { status: 400 });
  }

  const property = await createProperty(body);
  return NextResponse.json({ property }, { status: 201 });
}
