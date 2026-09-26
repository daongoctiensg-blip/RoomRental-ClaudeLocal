"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import AmenityPicker from "@/components/AmenityPicker";
import ImageListEditor from "@/components/ImageListEditor";
import type { Property, Room, SubUnit } from "@/types";

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
  const [maxOccupancy, setMaxOccupancy] = useState<number | "">(
    room?.maxOccupancy ?? ""
  );
  const [description, setDescription] = useState(room?.description ?? "");
  const [internalNotes, setInternalNotes] = useState(room?.internalNotes ?? "");
  const [images, setImages] = useState<string[]>(room?.images ?? []);
  const [amenitiesOverride, setAmenitiesOverride] = useState<string[]>(
    room?.amenitiesOverride ?? []
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
      // Round 12 fix: cleared fields are sent as null, not undefined —
      // JSON.stringify drops undefined keys entirely, so clearing e.g. the
      // description or internal notes of an EXISTING room used to be
      // silently ignored by PUT /api/rooms/[id] (the old value stayed).
      floor: floor || null,
      areaSqm: Number(areaSqm),
      hasBalcony,
      priceMonthly: Number(priceMonthly),
      maxOccupancy: maxOccupancy === "" ? null : Number(maxOccupancy),
      status: room?.status ?? "available",
      description: description || null,
      internalNotes: internalNotes || null,
      images,
      // Empty = use the property's shared amenities (stored as NULL).
      amenitiesOverride: amenitiesOverride.length > 0 ? amenitiesOverride : null,
      subUnits: subUnits.length > 0 ? subUnits : null,
      isActive: room?.isActive ?? true,
    };

    const url = apiUrl(room ? `/api/rooms/${room.id}` : "/api/rooms");
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
            <span className="text-sm font-medium text-slate-700">
              Sức chứa tối đa (số người)
            </span>
            <input
              type="number"
              min={1}
              value={maxOccupancy}
              onChange={(e) =>
                setMaxOccupancy(e.target.value === "" ? "" : Number(e.target.value))
              }
              className={inputClass}
              placeholder="Để trống nếu không áp dụng"
            />
            <span className="text-xs text-slate-400">
              Dùng cho bộ lọc &quot;Số người ở&quot; bên trang khách xem.
            </span>
          </label>

          {room ? (
            <p className="flex flex-col justify-end gap-1 text-xs text-slate-400">
              Trạng thái phòng được đổi ở trang danh sách (Nhận cọc / Chốt hợp
              đồng / Sửa chữa…), không sửa ở đây.
            </p>
          ) : null}

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
        <div className="mt-4 flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Ảnh phòng</span>
          <ImageListEditor value={images} onChange={setImages} />
        </div>
        <label className="mt-4 flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">
            Tiện ích riêng của phòng (để trống = dùng tiện ích chung của nhà)
          </span>
        </label>
        <div className="mt-1">
          <AmenityPicker value={amenitiesOverride} onChange={setAmenitiesOverride} />
        </div>
      </section>

      <section className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
        <label className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-sm font-medium text-amber-900">
            Ghi chú nội bộ (Sale)
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
              Khách không thấy mục này
            </span>
          </span>
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={2}
            placeholder="VD: khách hẹn xem phòng thứ 5, đang thương lượng giảm giá…"
            className={`${inputClass} bg-white`}
          />
          <span className="text-xs text-amber-700">
            Hoàn toàn khác với Mô tả ở trên (mục đó công khai cho khách xem).
          </span>
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
