"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Property, Room, RoomStatus, SubUnit } from "@/types";
import { ROOM_STATUSES, ROOM_STATUS_LABEL } from "@/types";

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function RoomForm({
  room,
  properties,
  defaultPropertyId,
}: {
  room?: Room;
  properties: Property[];
  defaultPropertyId?: string;
}) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(
    room?.propertyId ?? defaultPropertyId ?? properties[0]?.id ?? ""
  );
  const [code, setCode] = useState(room?.code ?? "");
  const [floor, setFloor] = useState(room?.floor ?? "");
  const [areaSqm, setAreaSqm] = useState(room?.areaSqm ?? 0);
  const [hasBalcony, setHasBalcony] = useState(room?.hasBalcony ?? false);
  const [priceMonthly, setPriceMonthly] = useState(room?.priceMonthly ?? 0);
  const [status, setStatus] = useState<RoomStatus>(room?.status ?? "available");
  const [description, setDescription] = useState(room?.description ?? "");
  const [images, setImages] = useState((room?.images ?? []).join("\n"));
  const [amenitiesOverride, setAmenitiesOverride] = useState(
    (room?.amenitiesOverride ?? []).join("\n")
  );
  const [subUnits, setSubUnits] = useState<SubUnit[]>(room?.subUnits ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      propertyId,
      code,
      floor: floor || undefined,
      areaSqm: Number(areaSqm),
      hasBalcony,
      priceMonthly: Number(priceMonthly),
      status,
      description: description || undefined,
      images: splitLines(images),
      amenitiesOverride:
        amenitiesOverride.trim().length > 0
          ? splitLines(amenitiesOverride)
          : undefined,
      subUnits: subUnits.length > 0 ? subUnits : undefined,
      isActive: room?.isActive ?? true,
    };

    const url = room ? `/api/rooms/${room.id}` : "/api/rooms";
    const method = room ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Có lỗi xảy ra");
      return;
    }

    router.push("/admin");
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Thuộc nhà</span>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className={inputClass}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Mã phòng</span>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Tầng</span>
            <input
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">
              Diện tích (m²)
            </span>
            <input
              type="number"
              value={areaSqm}
              onChange={(e) => setAreaSqm(Number(e.target.value))}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">
              Giá thuê / tháng (VND)
            </span>
            <input
              type="number"
              value={priceMonthly}
              onChange={(e) => setPriceMonthly(Number(e.target.value))}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Trạng thái</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RoomStatus)}
              className={inputClass}
            >
              {ROOM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ROOM_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasBalcony}
              onChange={(e) => setHasBalcony(e.target.checked)}
            />
            <span className="text-sm font-medium text-slate-700">Có ban công</span>
          </label>
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Mô tả</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </label>
        <label className="mt-4 flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">
            Ảnh phòng (mỗi dòng 1 URL)
          </span>
          <textarea
            value={images}
            onChange={(e) => setImages(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </label>
        <label className="mt-4 flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">
            Tiện ích riêng (để trống nếu dùng chung với nhà)
          </span>
          <textarea
            value={amenitiesOverride}
            onChange={(e) => setAmenitiesOverride(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </label>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Phòng ngủ / khu riêng bên trong (nếu có)
        </h2>
        <div className="flex flex-col gap-2">
          {subUnits.map((su, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                placeholder="Tên (VD: Phòng ngủ 1)"
                value={su.label}
                onChange={(e) =>
                  setSubUnits((list) =>
                    list.map((x, idx) =>
                      idx === i ? { ...x, label: e.target.value } : x
                    )
                  )
                }
                className={`${inputClass} flex-1 min-w-[160px]`}
              />
              <input
                placeholder="Ghi chú"
                value={su.notes ?? ""}
                onChange={(e) =>
                  setSubUnits((list) =>
                    list.map((x, idx) =>
                      idx === i ? { ...x, notes: e.target.value } : x
                    )
                  )
                }
                className={`${inputClass} flex-1 min-w-[160px]`}
              />
              <button
                type="button"
                onClick={() =>
                  setSubUnits((list) => list.filter((_, idx) => idx !== i))
                }
                className="text-xs text-red-500 hover:underline"
              >
                Xoá
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setSubUnits((list) => [...list, { label: "", notes: "" }])
            }
            className="self-start text-xs font-medium text-[color:var(--color-accent)] hover:underline"
          >
            + Thêm khu riêng
          </button>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !propertyId}
          className="rounded-lg bg-[color:var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--color-accent-dark)] disabled:opacity-60"
        >
          {saving ? "Đang lưu…" : "Lưu"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[color:var(--color-accent)] focus:outline-none";
