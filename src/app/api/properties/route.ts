import { NextRequest, NextResponse } from "next/server";
import { createProperty, listProperties, type PropertyInput } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";
  const properties = await listProperties({ includeInactive });
  return NextResponse.json({ properties });
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
