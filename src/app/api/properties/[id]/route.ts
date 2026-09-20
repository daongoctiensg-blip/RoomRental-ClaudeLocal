import { NextRequest, NextResponse } from "next/server";
import {
  deactivateProperty,
  getProperty,
  toPublicProperty,
  updateProperty,
  type PropertyInput,
} from "@/lib/db";
import { isAdminRequest, requireAdmin } from "@/lib/apiAuth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const admin = isAdminRequest(request);
  // A deactivated property is unlisted from the public site, not deleted —
  // an admin (who needs it to re-activate/edit it) can still fetch it by
  // id, but a non-admin caller must get the same "Not found" as a truly
  // missing id, not the property's public details. Found in QA: this had
  // no active-status check at all, so a deactivated property's name,
  // address, images, and contact phone stayed fully retrievable by anyone
  // who had (or guessed) its id.
  if (!admin && !property.isActive) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ property: admin ? property : toPublicProperty(property) });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Partial<PropertyInput> | null;
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const result = await updateProperty(id, body);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ property: result });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const ok = await deactivateProperty(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
