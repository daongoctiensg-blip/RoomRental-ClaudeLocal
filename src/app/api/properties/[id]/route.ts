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
  return NextResponse.json({ property: admin ? property : toPublicProperty(property) });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Partial<PropertyInput> | null;
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const property = await updateProperty(id, body);
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ property });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const ok = await deactivateProperty(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
