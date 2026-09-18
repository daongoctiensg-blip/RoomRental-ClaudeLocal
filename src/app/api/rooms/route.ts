import { NextRequest, NextResponse } from "next/server";
import { createRoom, listRooms, type RoomInput } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import type { RoomFilter, RoomStatus } from "@/types";
import { ROOM_STATUSES } from "@/types";
import { bucketByKey } from "@/lib/priceBuckets";

// GET /api/rooms?status=available,deposited&priceBucket=3-4&address=phu+thuan
// GET /api/rooms?propertyId=...
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const filter: RoomFilter = {};

  const propertyId = searchParams.get("propertyId");
  if (propertyId) filter.propertyId = propertyId;

  const address = searchParams.get("address");
  if (address) filter.address = address;

  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is RoomStatus =>
        (ROOM_STATUSES as string[]).includes(s)
      );
    if (statuses.length > 0) filter.status = statuses;
  }

  const priceBucketKey = searchParams.get("priceBucket");
  if (priceBucketKey) {
    const bucket = bucketByKey(priceBucketKey);
    if (bucket) {
      filter.priceMin = bucket.min;
      if (bucket.max !== null) filter.priceMax = bucket.max;
    }
  } else {
    const priceMin = searchParams.get("priceMin");
    const priceMax = searchParams.get("priceMax");
    if (priceMin) filter.priceMin = Number(priceMin);
    if (priceMax) filter.priceMax = Number(priceMax);
  }

  const rooms = await listRooms(filter);
  return NextResponse.json({ rooms });
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as RoomInput | null;
  if (!body || !body.propertyId || !body.code) {
    return NextResponse.json({ error: "Invalid room payload" }, { status: 400 });
  }

  const room = await createRoom(body);
  return NextResponse.json({ room }, { status: 201 });
}
