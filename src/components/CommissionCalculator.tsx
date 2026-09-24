"use client";

import { useMemo, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { formatVnd } from "@/lib/format";

type CalcRoom = { id: string; code: string; priceMonthly: number; propertyId: string };
type CalcProperty = {
  id: string;
  name: string;
  commissionPolicy: { contractDurationMonths: number; commissionPercent: number }[];
};

type PreviewResult = {
  roomCode: string;
  propertyName: string;
  priceMonthly: number;
  contractDurationMonths: number;
  commissionPercent: number;
  commissionAmount: number;
  bonusApplicable: boolean;
  bonusAmount: number;
  bonusDescription: string | null;
  totalSaleEarnings: number;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Interactive commission calculator — round 10, §18. Pick a room + contract
 * duration + sign date, get back a preview of commission + lì xì
 * applicability + total sale earnings — reusing the exact same
 * calculateCommission() logic as the real "Chốt hợp đồng" flow, via
 * GET /api/commissions/preview. PREVIEW ONLY: this never writes to the
 * database, never creates a contract/event record — it's purely for a sale
 * rep to check "what would I earn on this?" before actually closing.
 */
export default function CommissionCalculator({
  rooms,
  properties,
}: {
  rooms: CalcRoom[];
  properties: CalcProperty[];
}) {
  const propertiesById = useMemo(
    () => new Map(properties.map((p) => [p.id, p])),
    [properties]
  );

  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const selectedRoom = rooms.find((r) => r.id === roomId);
  const selectedProperty = selectedRoom ? propertiesById.get(selectedRoom.propertyId) : undefined;

  const [months, setMonths] = useState<number>(
    selectedProperty?.commissionPolicy[0]?.contractDurationMonths ?? 6
  );
  const [signDate, setSignDate] = useState(today());
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onRoomChange = (id: string) => {
    setRoomId(id);
    const room = rooms.find((r) => r.id === id);
    const property = room ? propertiesById.get(room.propertyId) : undefined;
    setMonths(property?.commissionPolicy[0]?.contractDurationMonths ?? 6);
    setResult(null);
    setError(null);
  };

  const onCalculate = async () => {
    if (!roomId) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({
        roomId,
        contractDurationMonths: String(months),
        signDate,
      });
      const res = await fetch(apiUrl(`/api/commissions/preview?${params.toString()}`));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Có lỗi xảy ra");
        return;
      }
      setResult(data as PreviewResult);
    } finally {
      setBusy(false);
    }
  };

  if (rooms.length === 0) {
    return (
      <div className="rounded-xl bg-white p-5 text-sm text-slate-400 shadow-sm ring-1 ring-black/5">
        Chưa có phòng nào để tính thử hoa hồng.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h2 className="mb-1 text-base font-semibold text-slate-900">
        Tính thử hoa hồng
      </h2>
      <p className="mb-4 text-xs text-slate-400">
        Chỉ xem trước — không lưu, không ảnh hưởng gì tới phòng hay hợp đồng thật.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Phòng
          <select
            value={roomId}
            onChange={(e) => onRoomChange(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {propertiesById.get(r.propertyId)?.name ?? ""} — {r.code} (
                {formatVnd(r.priceMonthly)})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Thời hạn hợp đồng
          {selectedProperty && selectedProperty.commissionPolicy.length > 0 ? (
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              {selectedProperty.commissionPolicy.map((t) => (
                <option key={t.contractDurationMonths} value={t.contractDurationMonths}>
                  {t.contractDurationMonths} tháng ({t.commissionPercent}%)
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              min={1}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          )}
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Ngày ký (giả định)
          <input
            type="date"
            value={signDate}
            onChange={(e) => setSignDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>

        <button
          type="button"
          disabled={busy || !roomId}
          onClick={onCalculate}
          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Tính thử
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {result ? (
        <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">
            {result.propertyName} — {result.roomCode} · Hợp đồng {result.contractDurationMonths} tháng
          </p>
          <p className="mt-1">
            Hoa hồng {result.commissionPercent}% ={" "}
            <strong>{formatVnd(result.commissionAmount)}</strong>
          </p>
          {result.bonusApplicable ? (
            <p>
              + Lì xì ({result.bonusDescription}):{" "}
              <strong>{formatVnd(result.bonusAmount)}</strong>
            </p>
          ) : (
            <p className="text-emerald-700/70">
              Không có lì xì áp dụng cho ngày ký này.
            </p>
          )}
          <p className="mt-2 text-base font-bold">
            Tổng thu nhập sale: {formatVnd(result.totalSaleEarnings)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
