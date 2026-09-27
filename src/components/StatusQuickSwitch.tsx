"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import type { RoomStatus } from "@/types";
import { useAlertDialog } from "@/components/dialogs/DialogProvider";

/**
 * "1-click" status change — round 10, §16. Deliberately restricted to
 * available <-> renovating: those are the only two transitions with no
 * money attached (see PUT /api/rooms/[id]/status, which itself rejects
 * "deposited"/"sold"). Renders nothing for any other status — "Đã cọc"/"Đã
 * cho thuê" must keep going through the dedicated Nhận cọc/Chốt hợp đồng
 * flows in <RoomActions> that capture the financial snapshot, never this
 * shortcut.
 */
export default function StatusQuickSwitch({
  roomId,
  status,
  size = "sm",
}: {
  roomId: string;
  status: RoomStatus;
  /** "lg" = 38px touch target on the mobile admin cards (round 13). */
  size?: "sm" | "lg";
}) {
  const router = useRouter();
  const alertDialog = useAlertDialog();
  const [busy, setBusy] = useState(false);

  if (status !== "available" && status !== "renovating") return null;

  const onChange = async (next: string) => {
    if (next === status || (next !== "available" && next !== "renovating")) return;
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/rooms/${roomId}/status`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        await alertDialog(data.error ?? "Có lỗi xảy ra");
      }
    } finally {
      setBusy(false);
      router.refresh();
    }
  };

  return (
    <select
      value={status}
      disabled={busy}
      onChange={(e) => onChange(e.target.value)}
      title="Đổi nhanh trạng thái (chỉ Trống ↔ Sửa chữa — Đã cọc/Đã cho thuê cần qua luồng riêng)"
      aria-label="Đổi nhanh trạng thái"
      className={`rounded-lg border border-slate-300 text-slate-600 disabled:opacity-60 ${
        size === "lg" ? "h-[38px] rounded-[10px] px-2.5 text-[13px]" : "px-1.5 py-0.5 text-xs"
      }`}
    >
      <option value="available">Trống</option>
      <option value="renovating">Sửa chữa</option>
    </select>
  );
}
