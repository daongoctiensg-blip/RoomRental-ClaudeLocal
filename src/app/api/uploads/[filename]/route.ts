import { NextRequest, NextResponse } from "next/server";
import { readUploadedFile } from "@/lib/db";

type Params = { params: Promise<{ filename: string }> };

const CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(_request: NextRequest, { params }: Params) {
  const { filename } = await params;

  // Chặn path traversal (../..) — chỉ chấp nhận đúng dạng <uuid>.<ext> do route upload tự sinh ra
  if (!/^[a-f0-9-]+\.(jpg|png|webp|gif)$/i.test(filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = readUploadedFile(filename);
  if (!bytes) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = filename.split(".").pop()!.toLowerCase();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": CONTENT_TYPE[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
