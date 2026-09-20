import { NextRequest, NextResponse } from "next/server";
import { addRoomDocument, listRoomDocuments } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import { DOCUMENT_TYPES, type DocumentType } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const documents = await listRoomDocuments(id);
  return NextResponse.json({ documents });
}

// Call this AFTER uploading the file itself via /api/documents/upload — this
// endpoint just records the {type, fileUrl, fileName} metadata against the room.
export async function POST(request: NextRequest, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const type = body?.type as DocumentType | undefined;
  const fileUrl = body?.fileUrl as string | undefined;
  const fileName = body?.fileName as string | undefined;

  if (!type || !(DOCUMENT_TYPES as string[]).includes(type) || !fileUrl || !fileName) {
    return NextResponse.json({ error: "Thiếu type/fileUrl/fileName hợp lệ" }, { status: 400 });
  }
  // fileUrl must point at a file this app actually stored via
  // /api/documents/upload — never an arbitrary URL an admin-panel bug or
  // compromised admin session could otherwise smuggle into a document
  // record (e.g. served later to another admin as if it were a real file).
  if (!/^\/api\/documents\/file\/[a-f0-9-]+\.(jpg|png|webp|pdf)$/.test(fileUrl)) {
    return NextResponse.json({ error: "fileUrl không hợp lệ" }, { status: 400 });
  }

  const result = await addRoomDocument(id, { type, fileUrl, fileName, note: body?.note });
  if ("error" in result) return NextResponse.json(result, { status: 404 });
  return NextResponse.json({ document: result }, { status: 201 });
}
