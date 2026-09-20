import Link from "next/link";
import { listAllEvents, listProperties, listRooms } from "@/lib/db";
import { formatVnd } from "@/lib/format";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function CommissionsPage() {
  const [events, rooms, properties] = await Promise.all([
    listAllEvents(),
    // includeInactiveProperties: past transactions on a now-unlisted
    // property must still resolve to a real room code here, not
    // "(phòng đã xoá)" — nothing was deleted, it was just unlisted.
    listRooms(undefined, { includeInactiveProperties: true }),
    listProperties({ includeInactive: true }),
  ]);

  const roomsById = new Map(rooms.map((r) => [r.id, r]));
  const propertiesById = new Map(properties.map((p) => [p.id, p]));

  const relevant = events
    .filter((e) => e.type === "contract_signed" || e.type === "deposit_cancelled")
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));

  const totalCommission = relevant.reduce(
    (sum, e) => sum + (e.contract?.commissionAmount ?? 0),
    0
  );
  const totalBonus = relevant.reduce(
    (sum, e) => sum + (e.contract?.bonusAmount ?? 0),
    0
  );
  const totalCancellationSaleShare = relevant.reduce(
    (sum, e) => sum + (e.cancellation?.saleTotal ?? 0),
    0
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">
          Hoa hồng &amp; lì xì
        </h1>
        <Link
          href="/admin"
          className="text-sm font-medium text-[color:var(--color-accent)] hover:underline"
        >
          ← Về dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Tổng hoa hồng" value={formatVnd(totalCommission)} />
        <SummaryCard label="Tổng lì xì" value={formatVnd(totalBonus)} />
        <SummaryCard
          label="Tổng nhận từ huỷ cọc"
          value={formatVnd(totalCancellationSaleShare)}
        />
      </div>

      <div className="overflow-x-auto rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-2">Thời gian</th>
              <th className="py-2">Phòng</th>
              <th className="py-2">Loại</th>
              <th className="py-2">Hoa hồng</th>
              <th className="py-2">Lì xì</th>
              <th className="py-2">Nhận từ huỷ cọc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {relevant.map((e) => {
              const room = roomsById.get(e.roomId);
              const property = room ? propertiesById.get(room.propertyId) : undefined;
              return (
                <tr key={e.id}>
                  <td className="py-2 text-xs text-slate-500">
                    {formatDateTime(e.occurredAt)}
                  </td>
                  <td className="py-2">
                    <span className="font-medium text-slate-800">
                      {room?.code ?? "(phòng đã xoá)"}
                    </span>
                    <span className="ml-1 text-xs text-slate-400">
                      {property?.name ?? ""}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-slate-600">
                    {e.type === "contract_signed" ? "Chốt hợp đồng" : "Khách huỷ cọc"}
                  </td>
                  <td className="py-2">
                    {e.contract
                      ? `${formatVnd(e.contract.commissionAmount)} (${e.contract.commissionPercent}%)`
                      : "—"}
                  </td>
                  <td className="py-2">
                    {e.contract?.bonusApplicable
                      ? formatVnd(e.contract.bonusAmount)
                      : "—"}
                  </td>
                  <td className="py-2">
                    {e.cancellation ? formatVnd(e.cancellation.saleTotal) : "—"}
                  </td>
                </tr>
              );
            })}
            {relevant.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400">
                  Chưa có giao dịch nào.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
