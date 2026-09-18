import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/apiAuth";

export async function GET(request: NextRequest) {
  return NextResponse.json({ isAdmin: isAdminRequest(request) });
}
