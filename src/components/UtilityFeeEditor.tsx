"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UtilityFeeVersion } from "@/types";
import { formatVnd } from "@/lib/format";

export default function UtilityFeeEditor({
  propertyId,
  versions,
}: {
  propertyId: string;
  versions: UtilityFeeVersion[];
}) {
  const router = useRouter();
  const [electricity, setElectricity] = useState("4000");
  const [water, setWater] = useState("100000");
  const [service, setService] = useState("200000");
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [saving, setSaving] = useState(false);

  const sorted = [...versions].sort((a, b) =>
    a.effectiveFrom < b.effectiveFrom ? 1 : -1
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/properties/${propertyId}/utility-fees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        electricityPricePerKwh: Number(electricity),
        waterPricePerPerson: Number(water),
        serviceFeePerMonth: Number(service),
        effectiveFrom,
      }),
    });
    setSaving(false);
    router.refresh();
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Phí điện / nước / dịch vụ (lịch sử theo thời gian)
      </h2>

      <div className="mb-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-1">Hiệu lực từ</th>
              <th className="py-1">Điện</th>
              <th className="py-1">Nước</th>
              <th className="py-1">Phí dịch vụ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((v) => (
              <tr key={v.id}>
                <td className="py-1">{v.effectiveFrom}</td>
                <td className="py-1">{formatVnd(v.electricityPricePerKwh)}/kWh</td>
                <td className="py-1">{formatVnd(v.waterPricePerPerson)}/người</td>
                <td className="py-1">{formatVnd(v.serviceFeePerMonth)}/tháng</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Điện (đ/kWh)</span>
          <input
            type="number"
            value={electricity}
            onChange={(e) => setElectricity(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Nước (đ/người)</span>
          <input
            type="number"
            value={water}
            onChange={(e) => setWater(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Phí dịch vụ (đ/tháng)</span>
          <input
            type="number"
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Hiệu lực từ</span>
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="col-span-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60 sm:col-span-1"
        >
          {saving ? "Đang lưu…" : "+ Thêm mức giá mới"}
        </button>
      </form>
    </section>
  );
}
