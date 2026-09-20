import { NextRequest, NextResponse } from "next/server";
import { createProperty, listProperties, toPublicProperty, type PropertyInput } from "@/lib/db";
import { isAdminRequest, requireAdmin } from "@/lib/apiAuth";

// Public endpoint — non-admin callers only get the customer-safe shape
// (no commission %, no landlord contact, no "lì xì").
export async function GET(request: NextRequest) {
  const admin = isAdminRequest(request);
  // Found in QA: this used to honor ?includeInactive=true for ANY caller,
  // not just admins — a visitor could call this with that query param and
  // get back deactivated/unlisted properties (name, address, images,
  // contact phone) that deactivateProperty() was supposed to hide from the
  // public site. A deactivated property is unlisted, not deleted — it must
  // never be visible to an unauthenticated caller by any query param.
  const { searchParams } = new URL(request.url);
  const includeInactive = admin && searchParams.get("includeInactive") === "true";
  const properties = await listProperties({ includeInactive });
  return NextResponse.json({
    properties: admin ? properties : properties.map(toPublicProperty),
  });
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as PropertyInput | null;
  if (!body || !body.name || !body.addressNew || !body.city || !body.ward) {
    return NextResponse.json({ error: "Invalid property payload" }, { status: 400 });
  }

  const result = await createProperty(body);
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ property: result }, { status: 201 });
}
