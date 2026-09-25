import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { deleteAmenity, updateAmenity } from "@/lib/amenityCatalog";

type Params = { params: Promise<{ id: string }> };

/** Rename / re-group / change icon / toggle "phổ biến". A rename is applied
 * to every property/room that uses the old name, in the same transaction. */
export async function PUT(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const patch: { name?: string; group?: string; icon?: string; isPopular?: boolean } = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.group === "string") patch.group = body.group;
  if (typeof body.icon === "string") patch.icon = body.icon;
  if (typeof body.isPopular === "boolean") patch.isPopular = body.isPopular;

  const res = await updateAmenity(id, patch);
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ amenity: res });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  const res = await deleteAmenity(id);
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (res !== true) return NextResponse.json({ error: res.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
