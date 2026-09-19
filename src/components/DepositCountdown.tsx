"use client";

import { useEffect, useState } from "react";

/** Live countdown ("còn 3 ngày 4 giờ") computed from a fixed deadline —
 * ticks client-side every minute, no server polling needed. */
export default function DepositCountdown({ deadlineIso }: { deadlineIso: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = new Date(deadlineIso).getTime() - now;
  if (remainingMs <= 0) {
    return <span className="text-xs font-medium text-red-600">Đã hết hạn giữ cọc</span>;
  }

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);

  return (
    <span className="text-xs font-medium text-amber-700">
      Còn {days > 0 ? `${days} ngày ` : ""}
      {hours} giờ giữ cọc
    </span>
  );
}
