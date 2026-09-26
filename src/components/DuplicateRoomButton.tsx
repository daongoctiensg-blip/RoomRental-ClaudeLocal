"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import { useConfirm, useAlertDialog } from "@/components/dialogs/DialogProvider";
import type { Room } from "@/types";

/**
 * "Nhân bản phòng" — round 11. For a building with many near-identical
 * rooms (same layout/amenities, different code/floor), re-typing the whole
 * form each time is tedious. Copies every field except id/status/viewCount/
 * currentDeposit/timestamps (all reset by createRoom() itself — see
 * RoomInput's Omit list in src/lib/db.ts), appends "(bản sao)" to the code
 * so it's obviously a duplicate, and lands the admin straight on the new
 * room's edit page to adjust the code/floor/price before it goes live.
 */
export default function DuplicateRoomButton({ room }: { room: Room }) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const alertDialog = useAlertDialog();
  const [busy, setBusy] = useState(false);

  const onDuplicate = async () => {
    const ok = await confirmDialog({
      title: "Nhân bản phòng",
      message: `Tạo 1 phòng mới sao chép toàn bộ thông tin của "${room.code}"? Anh sẽ được đưa tới trang sửa để đổi mã phòng/tầng/giá trước khi lưu.`,
      confirmLabel: "Nhân bản",
    });
    if (!ok) return;

    setBusy(true);
    try {
      const payload = {
        propertyId: room.propertyId,
        code: `${room.code} (bản sao)`,
        floor: room.floor,
        areaSqm: room.areaSqm,
        hasBalcony: room.hasBalcony,
        priceMonthly: room.priceMonthly,
        maxOccupancy: room.maxOccupancy,
        description: room.description,
        internalNotes: room.internalNotes,
        images: room.images,
        amenitiesAdded: room.amenitiesAdded,
        amenitiesRemoved: room.amenitiesRemoved,
        subUnits: room.subUnits,
        status: "available" as const,
        isActive: true,
      };
      const res = await fetch(apiUrl("/api/rooms"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await alertDialog(data.error ?? "Nhân bản phòng thất bại");
        return;
      }
      router.push(`/admin/rooms/${data.room.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onDuplicate}
      className="text-xs font-medium text-slate-400 hover:text-slate-700 disabled:opacity-60"
      title="Tạo phòng mới sao chép thông tin phòng này"
    >
      {busy ? "Đang tạo…" : "Nhân bản"}
    </button>
  );
}
