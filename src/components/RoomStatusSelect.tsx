"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROOM_STATUSES, ROOM_STATUS_LABEL, type RoomStatus } from "@/types";

export default function RoomStatusSelect({
  roomId,
  status,
}: {
  roomId: string;
  status: RoomStatus;
}) {
  const router = useRouter();
  const [value, setValue] = useState<RoomStatus>(status);
  const [isPending, startTransition] = useTransition();

  const onChange = async (next: RoomStatus) => {
    setValue(next);
    await fetch(`/api/rooms/${roomId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    startTransition(() => router.refresh());
  };

  return (
    <select
      value={value}
      disabled={isPending}
      onChange={(e) => onChange(e.target.value as RoomStatus)}
      className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:opacity-60"
    >
      {ROOM_STATUSES.map((s) => (
        <option key={s} value={s}>
          {ROOM_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
