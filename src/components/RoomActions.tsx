"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import Link from "next/link";
import type { CommissionTier, RoomStatus } from "@/types";
import { formatVnd } from "@/lib/format";
import DepositCountdown from "@/components/DepositCountdown";
import { useConfirm } from "@/components/dialogs/DialogProvider";

type Props = {
  roomId: string;
  status: RoomStatus;
  currentDeposit?: { depositedAt: string; holdAmount: number; holdDays: number };
  commissionPolicy: CommissionTier[];
};

export default function RoomActions({
  roomId,
  status,
  currentDeposit,
  commissionPolicy,
}: Props) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<React.ReactNode | null>(null);
  const [showContractForm, setShowContractForm] = useState(false);
  const [months, setMonths] = useState(commissionPolicy[0]?.contractDurationMonths ?? 6);

  const call = async (url: string, body?: unknown) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(<span className="text-red-600">{data.error ?? "Có lỗi xảy ra"}</span>);
        return null;
      }
      return data;
    } finally {
      setBusy(false);
      router.refresh();
    }
  };

  const onStartDeposit = async () => {
    const ok = await confirmDialog("Xác nhận khách đã đặt cọc giữ phòng?");
    if (!ok) return;
    await call(apiUrl(`/api/rooms/${roomId}/deposit`));
  };

  const onCancelDeposit = async () => {
    const ok = await confirmDialog({
      title: "Huỷ cọc",
      message:
        "Khách chủ động huỷ cọc trước hạn? (dùng cho trường hợp khách quay lại báo huỷ, KHÔNG dùng cho trường hợp khách im lặng biến mất — case đó hệ thống tự xử lý khi hết hạn)",
      confirmLabel: "Huỷ cọc",
      danger: true,
    });
    if (!ok) return;
    const data = await call(apiUrl(`/api/rooms/${roomId}/deposit/cancel`));
    if (data?.settlement) {
      const s = data.settlement;
      setMessage(
        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          Đã giữ {s.daysHeld}/{s.holdDays} ngày ({formatVnd(s.dailyRate)}/ngày).
          <br />
          Chủ nhà giữ: <strong>{formatVnd(s.landlordTotal)}</strong> (gồm {formatVnd(s.landlordCompensation)} tiền giữ chỗ + {formatVnd(s.landlordShareOfRemainder)} chia phần còn lại).
          <br />
          Sale nhận: <strong>{formatVnd(s.saleTotal)}</strong>.
        </div>
      );
    }
  };

  const onSignContract = async () => {
    const data = await call(apiUrl(`/api/rooms/${roomId}/contract`), {
      contractDurationMonths: Number(months),
    });
    if (data?.settlement) {
      const s = data.settlement;
      setMessage(
        <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">
          Hợp đồng {s.contractDurationMonths} tháng — hoa hồng {s.commissionPercent}% ={" "}
          <strong>{formatVnd(s.commissionAmount)}</strong>.
          {s.bonusApplicable ? (
            <>
              {" "}
              + Lì xì: <strong>{formatVnd(s.bonusAmount)}</strong>.
            </>
          ) : null}
        </div>
      );
      setShowContractForm(false);
    }
  };

  const putStatus = async (status: "available" | "renovating") => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl(`/api/rooms/${roomId}/status`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(<span className="text-red-600">{data.error ?? "Có lỗi xảy ra"}</span>);
      }
    } finally {
      setBusy(false);
      router.refresh();
    }
  };

  const onBackToAvailable = () => putStatus("available");
  const onRenovate = () => putStatus("renovating");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {status === "available" ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onStartDeposit}
              className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              Nhận cọc
            </button>
            <button
              type="button"
              disabled={busy || commissionPolicy.length === 0}
              onClick={() => setShowContractForm((v) => !v)}
              title={commissionPolicy.length === 0 ? "Chưa có mốc hoa hồng — thêm ở trang Sửa thông tin nhà trước" : undefined}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Chốt hợp đồng
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRenovate}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              Sửa chữa
            </button>
          </>
        ) : null}

        {status === "deposited" && currentDeposit ? (
          <>
            <DepositCountdown
              deadlineIso={new Date(
                new Date(currentDeposit.depositedAt).getTime() +
                  currentDeposit.holdDays * 24 * 60 * 60 * 1000
              ).toISOString()}
            />
            <button
              type="button"
              disabled={busy}
              onClick={onCancelDeposit}
              className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              Huỷ cọc
            </button>
            <button
              type="button"
              disabled={busy || commissionPolicy.length === 0}
              onClick={() => setShowContractForm((v) => !v)}
              title={commissionPolicy.length === 0 ? "Chưa có mốc hoa hồng — thêm ở trang Sửa thông tin nhà trước" : undefined}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Chốt hợp đồng
            </button>
          </>
        ) : null}

        {status === "renovating" ? (
          <button
            type="button"
            disabled={busy}
            onClick={onBackToAvailable}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Sửa xong, mở lại
          </button>
        ) : null}

        {status === "sold" ? (
          <span className="text-xs text-slate-400">Đã chốt hợp đồng</span>
        ) : null}

        <Link
          href={`/admin/rooms/${roomId}/history`}
          className="text-xs font-medium text-[color:var(--color-accent)] hover:underline"
        >
          Lịch sử
        </Link>
      </div>

      {showContractForm ? (
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
          <span className="text-xs text-slate-600">Thời hạn hợp đồng:</span>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          >
            {commissionPolicy.map((t) => (
              <option key={t.contractDurationMonths} value={t.contractDurationMonths}>
                {t.contractDurationMonths} tháng ({t.commissionPercent}%)
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={onSignContract}
            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Xác nhận
          </button>
        </div>
      ) : null}

      {message ? <div>{message}</div> : null}
    </div>
  );
}
