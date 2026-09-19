import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoom, listRoomEvents } from "@/lib/db";
import { ROOM_STATUS_EVENT_LABEL, ROOM_STATUS_LABEL } from "@/types";
import { formatVnd } from "@/lib/format";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function RoomHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [room, events] = await Promise.all([getRoom(id), listRoomEvents(id)]);
  if (!room) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">
          Lịch sử phòng {room.code}
        </h1>
        <Link
          href={`/admin/rooms/${room.id}`}
          className="text-sm font-medium text-[color:var(--color-accent)] hover:underline"
        >
          ← Về trang sửa phòng
        </Link>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        {events.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có lịch sử nào.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {events.map((e) => (
              <li
                key={e.id}
                className="border-l-2 border-slate-200 pl-4 text-sm"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium text-slate-800">
                    {ROOM_STATUS_EVENT_LABEL[e.type]}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatDateTime(e.occurredAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {ROOM_STATUS_LABEL[e.fromStatus]} → {ROOM_STATUS_LABEL[e.toStatus]}
                </p>

                {e.deposit ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Cọc giữ phòng {formatVnd(e.deposit.holdAmount)}, giữ{" "}
                    {e.deposit.holdDays} ngày.
                  </p>
                ) : null}

                {e.cancellation ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Đã giữ {e.cancellation.daysHeld}/{e.cancellation.holdDays} ngày
                    ({formatVnd(e.cancellation.dailyRate)}/ngày). Chủ nhà giữ{" "}
                    <strong>{formatVnd(e.cancellation.landlordTotal)}</strong>{" "}
                    (gồm {formatVnd(e.cancellation.landlordCompensation)} tiền
                    giữ chỗ + {formatVnd(e.cancellation.landlordShareOfRemainder)}{" "}
                    chia phần còn lại). Sale nhận{" "}
                    <strong>{formatVnd(e.cancellation.saleTotal)}</strong>.
                  </p>
                ) : null}

                {e.contract ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Hợp đồng {e.contract.contractDurationMonths} tháng — hoa hồng{" "}
                    {e.contract.commissionPercent}% ={" "}
                    <strong>{formatVnd(e.contract.commissionAmount)}</strong>.
                    {e.contract.bonusApplicable ? (
                      <>
                        {" "}
                        Lì xì: <strong>{formatVnd(e.contract.bonusAmount)}</strong>.
                      </>
                    ) : null}
                  </p>
                ) : null}

                {e.note ? (
                  <p className="mt-1 text-xs text-slate-400">{e.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
