"use client";

import { useEffect, useRef, useState } from "react";
import type { DocumentType, RoomDocument } from "@/types";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL } from "@/types";
import { apiUrl } from "@/lib/basePath";
import { useConfirm } from "@/components/dialogs/DialogProvider";

/** Upload + list giấy tờ (hợp đồng, giấy xác nhận cọc, ...) cho 1 phòng.
 * Admin-only: file lưu ở kho riêng (/api/documents/*), tách biệt hẳn với
 * ảnh phòng public. */
export default function RoomDocuments({ roomId }: { roomId: string }) {
  const [documents, setDocuments] = useState<RoomDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<DocumentType>(DOCUMENT_TYPES[0]);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirmDialog = useConfirm();

  const load = async () => {
    setLoading(true);
    const res = await fetch(apiUrl(`/api/rooms/${roomId}/documents`));
    const data = await res.json().catch(() => ({}));
    setDocuments(data.documents ?? []);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(apiUrl(`/api/rooms/${roomId}/documents`));
      const data = await res.json().catch(() => ({}));
      if (!cancelled) {
        setDocuments(data.documents ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const uploadRes = await fetch(apiUrl("/api/documents/upload"), {
        method: "POST",
        body,
      });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        setError(uploadData.error ?? "Tải file thất bại");
        return;
      }

      const recordRes = await fetch(apiUrl(`/api/rooms/${roomId}/documents`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          fileUrl: uploadData.url,
          fileName: uploadData.fileName,
          note: note || undefined,
        }),
      });
      const recordData = await recordRes.json().catch(() => ({}));
      if (!recordRes.ok) {
        setError(recordData.error ?? "Lưu thông tin giấy tờ thất bại");
        return;
      }
      setNote("");
      await load();
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Xoá giấy tờ",
      message: "Xoá giấy tờ này? Không thể hoàn tác.",
      confirmLabel: "Xoá",
      danger: true,
    });
    if (!ok) return;
    await fetch(apiUrl(`/api/rooms/${roomId}/documents/${id}`), { method: "DELETE" });
    await load();
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Giấy tờ (nội bộ)
      </h2>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">Loại giấy tờ</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DocumentType)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 min-w-[160px] flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">Ghi chú (tuỳ chọn)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          capture="environment"
          className="hidden"
          onChange={onPickFile}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:border-[color:var(--color-accent)] disabled:opacity-60"
        >
          {uploading ? "Đang tải lên…" : "📎 Chụp ảnh / tải file lên"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      <div className="mt-4 flex flex-col gap-2">
        {loading ? (
          <p className="text-xs text-slate-400">Đang tải…</p>
        ) : documents.length === 0 ? (
          <p className="text-xs text-slate-400">Chưa có giấy tờ nào.</p>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
              <div>
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[color:var(--color-accent)] hover:underline"
                >
                  {DOCUMENT_TYPE_LABEL[doc.type]}
                </a>
                <span className="ml-2 text-xs text-slate-400">{doc.fileName}</span>
                {doc.note ? (
                  <span className="ml-2 text-xs text-slate-400">· {doc.note}</span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onDelete(doc.id)}
                className="text-xs text-red-500 hover:underline"
              >
                Xoá
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
