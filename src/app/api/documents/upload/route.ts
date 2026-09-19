import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/apiAuth";
import { saveDocumentFile } from "@/lib/db";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const MAX_BYTES = 15 * 1024 * 1024; // 15MB — đủ cho ảnh chụp giấy tờ hoặc PDF vài trang

// POST /api/documents/upload — form-data field "file". Trả về { url } dạng
// /api/documents/file/<tên file>, CHỈ xem được khi đã đăng nhập admin (khác
// với /api/upload cho ảnh phòng, vốn public để khách xem được).
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
      { error: "Chỉ nhận ảnh JPG, PNG, WEBP hoặc PDF" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File quá lớn (tối đa 15MB)" }, { status: 400 });
  }

  const filename = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  saveDocumentFile(filename, bytes);

  return NextResponse.json({ url: `/api/documents/file/${filename}`, fileName: file.name });
}
