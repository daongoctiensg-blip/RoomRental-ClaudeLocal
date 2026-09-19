import { NextRequest, NextResponse } from "next/server";
import { readDocumentFile } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";

type Params = { params: Promise<{ filename: string }> };

const CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

// Admin-only — unlike /api/uploads/[filename] (room photos, public by
// design), documents can contain contracts/ID scans and must never be
// reachable without a valid admin session, even if the filename leaks.
export async function GET(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { filename } = await params;

  if (!/^[a-f0-9-]+\.(jpg|png|webp|pdf)$/i.test(filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = readDocumentFile(filename);
  if (!bytes) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = filename.split(".").pop()!.toLowerCase();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": CONTENT_TYPE[ext] ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
