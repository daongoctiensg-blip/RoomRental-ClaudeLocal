"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, ImagePlus, Link2, Loader2, X } from "lucide-react";
import { apiUrl, assetUrl } from "@/lib/basePath";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

/**
 * Photo list editor for the admin property/room forms — round 12d, replacing
 * the "one URL per line" textarea (owner: show uploaded photos as previews,
 * each with an X to remove). Stores exactly the same thing as before — an
 * ordered string[] of URLs — so nothing else in the app changes.
 *
 * - Thumbnails in order; the first one is the cover photo (it's what the
 *   homepage card and the detail page's big photo show), labeled "Ảnh bìa".
 *   ‹ › move a photo left/right, so the admin can pick the cover.
 * - X removes a photo from the list (the uploaded file stays on the server,
 *   same as removing a line from the old textarea did).
 * - "Tải ảnh lên" tile: pick several files at once, or drag & drop them
 *   onto the area. Each uploads through the existing /api/upload; a failed
 *   file doesn't stop the rest.
 * - "Dán link ảnh" keeps the old ability to use an external image URL.
 * - Thumbnails use object-contain on a neutral backdrop (same convention as
 *   AI 1's fixed-frame fix), so portrait and landscape photos both show
 *   whole.
 */
export default function ImageListEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [uploadingCount, setUploadingCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Uploads finish asynchronously; always append to the latest list, not the
  // one captured when the upload started (the admin may remove/reorder
  // photos while others are still uploading).
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const upload = async (files: File[]) => {
    const images = files.filter((f) => ACCEPT.split(",").includes(f.type));
    const skipped = files.length - images.length;
    setErrors(skipped > 0 ? [`Bỏ qua ${skipped} file không phải ảnh (JPG, PNG, WEBP, GIF).`] : []);
    if (images.length === 0) return;

    setUploadingCount((n) => n + images.length);
    for (const file of images) {
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch(apiUrl("/api/upload"), { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || typeof data.url !== "string") {
          setErrors((e) => [...e, data.error ?? `Tải lên "${file.name}" thất bại`]);
        } else {
          onChange([...valueRef.current, data.url]);
          valueRef.current = [...valueRef.current, data.url];
        }
      } catch {
        setErrors((e) => [...e, `Tải lên "${file.name}" thất bại (lỗi mạng)`]);
      } finally {
        setUploadingCount((n) => n - 1);
      }
    }
  };

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addLink = () => {
    const url = link.trim();
    if (!url) return;
    if (!/^(https?:\/\/|\/)/i.test(url)) {
      setErrors(["Link ảnh phải bắt đầu bằng http://, https:// hoặc /"]);
      return;
    }
    if (!value.includes(url)) onChange([...value, url]);
    setLink("");
    setLinkOpen(false);
    setErrors([]);
  };

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        setDragOver(false);
        void upload(Array.from(e.dataTransfer.files));
      }}
      className={`rounded-xl border-2 border-dashed p-3 transition ${
        dragOver ? "border-[color:var(--color-accent)] bg-sky-50" : "border-transparent"
      }`}
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {value.map((url, i) => (
          <li
            key={`${url}-${i}`}
            className="group relative overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200"
          >
            {broken.has(url) ? (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 p-2 text-center text-xs text-slate-500">
                <ImageOff className="h-5 w-5" aria-hidden />
                Không tải được ảnh
                <span className="line-clamp-2 break-all text-[10px] text-slate-400">{url}</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetUrl(url)}
                alt={`Ảnh ${i + 1}`}
                className="aspect-[4/3] w-full object-contain"
                onError={() => setBroken((b) => new Set(b).add(url))}
              />
            )}
            {i === 0 ? (
              <span className="absolute left-2 top-2 rounded-md bg-[color:var(--color-accent)] px-2 py-0.5 text-[11px] font-semibold text-white shadow">
                Ảnh bìa
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Xoá ảnh ${i + 1}`}
              title="Xoá ảnh này"
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white shadow hover:bg-red-600"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            {value.length > 1 ? (
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/50 to-transparent p-1.5">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Đưa ảnh ${i + 1} lên trước`}
                  title={i === 1 ? "Đặt làm ảnh bìa" : "Đưa lên trước"}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow disabled:invisible"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <span className="self-center text-[11px] font-medium text-white">
                  {i + 1}/{value.length}
                </span>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === value.length - 1}
                  aria-label={`Đưa ảnh ${i + 1} ra sau`}
                  title="Đưa ra sau"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow disabled:invisible"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : null}
          </li>
        ))}

        {Array.from({ length: uploadingCount }).map((_, i) => (
          <li
            key={`uploading-${i}`}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg bg-slate-50 text-xs text-slate-500 ring-1 ring-slate-200"
          >
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Đang tải lên…
          </li>
        ))}

        <li>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-sm font-medium text-slate-600 hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent-dark)]"
          >
            <ImagePlus className="h-6 w-6" aria-hidden />
            Tải ảnh lên
            <span className="text-[11px] font-normal text-slate-400">hoặc kéo thả ảnh vào đây</span>
          </button>
        </li>
      </ul>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ""; // allow picking the same file again later
          void upload(files);
        }}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {value.length > 0 ? (
          <span className="text-slate-500">
            {value.length} ảnh · ảnh đầu tiên là ảnh bìa, dùng ‹ › để đổi thứ tự.
          </span>
        ) : (
          <span className="text-slate-500">Chưa có ảnh.</span>
        )}
        {linkOpen ? (
          <span className="flex flex-1 items-center gap-2">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault(); // don't submit the surrounding form
                  addLink();
                } else if (e.key === "Escape") {
                  setLinkOpen(false);
                }
              }}
              placeholder="https://…"
              autoFocus
              className="min-w-[200px] flex-1 rounded-md border border-slate-300 px-2 py-1"
            />
            <button
              type="button"
              onClick={addLink}
              className="rounded-md bg-slate-800 px-2.5 py-1 font-medium text-white"
            >
              Thêm
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setLinkOpen(true)}
            className="inline-flex items-center gap-1 font-medium text-[color:var(--color-accent)] hover:underline"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Dán link ảnh
          </button>
        )}
      </div>
      {errors.length > 0 ? (
        <ul className="mt-1 text-xs text-red-600">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
