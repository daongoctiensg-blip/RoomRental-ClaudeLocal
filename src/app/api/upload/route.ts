import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/apiAuth";
import { saveUploadedFile } from "@/lib/db";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 8 * 1024 * 1024; // 8MB/ảnh — đủ cho ảnh phòng chụp thường, chặn upload quá khổ

// POST /api/upload — form-data field "file". Trả về { url } để dán vào ô "Ảnh phòng".
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Ảnh quá lớn (tối đa 8MB)" },
      { status: 400 }
    );
  }

  const filename = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  saveUploadedFile(filename, bytes);

  return NextResponse.json({ url: `/api/uploads/${filename}` });
}
