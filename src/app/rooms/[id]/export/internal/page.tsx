import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { calculateCommission, getRoom, toPublicRoom } from "@/lib/db";
import { isAdminSession } from "@/lib/apiAuth";
import { formatVnd } from "@/lib/format";
import { isBonusActiveToday } from "@/lib/saleBonus";
import { ROOM_STATUS_LABEL } from "@/types";
import RoomExportSheet from "@/components/export/RoomExportSheet";

export const dynamic = "force-dynamic";

// The browser uses <title> as the default file name when saving as PDF, so
// the internal copy gets "NỘI BỘ" in it — it can't be mistaken for (or
// attached in place of) the customer copy by file name alone. A non-admin
// gets a generic title: the room code must not leak into a 404 page's head.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const robots = { index: false, follow: false };
  if (!(await isAdminSession())) return { title: "Không tìm thấy", robots };
  const { id } = await params;
  const room = await getRoom(id);
  return { title: room ? `NỘI BỘ - Phòng ${room.code}` : "Không tìm thấy", robots };
}

/**
 * SALES-ONLY print view: the same sheet as the customer export plus the
 * commission tiers, the sale bonus ("lì xì") and the deposit-cancellation
 * split. Admin-gated on the server (a non-admin gets a 404, not a hint that
 * the page exists). Landlord contact and the internal note are NOT printed
 * — they stay on the screen-only "Nội bộ (Sale)" panel.
 */
export default async function RoomInternalExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminSession())) notFound();
  const { id } = await params;
  const fullRoom = await getRoom(id);
  if (!fullRoom) notFound();

  const p = fullRoom.property;
  const bonus = p.saleBonusPolicy;
  const cancel = p.depositCancellationPolicy;
  const tiers = [...p.commissionPolicy].sort((a, b) => a.contractDurationMonths - b.contractDurationMonths);

  const banner = (
    <div className="mb-6 break-inside-avoid rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 print:bg-transparent">
      <p className="font-bold">BẢN NỘI BỘ — CHỈ DÙNG CHO SALE, KHÔNG GỬI KHÁCH</p>
      <p className="mt-1">
        File này có hoa hồng, lì xì và tỉ lệ chia khi huỷ cọc. Gửi khách bằng nút “Xuất PDF” ở trang
        chi tiết phòng (bản khách).
      </p>
      <p className="mt-1">Trạng thái phòng hiện tại: <strong>{ROOM_STATUS_LABEL[fullRoom.status]}</strong></p>
    </div>
  );

  const internalSection = (
    <section className="mb-6 break-inside-avoid rounded-lg border-2 border-amber-300 bg-amber-50 p-4 print:bg-transparent">
      <h2 className="mb-3 text-base font-semibold text-amber-900">Thông tin nội bộ cho sale</h2>

      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
        Hoa hồng theo thời hạn hợp đồng
      </h3>
      {tiers.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-950">
          {tiers.map((t) => {
            const c = calculateCommission(fullRoom.priceMonthly, t.contractDurationMonths, p.commissionPolicy);
            return (
              <li key={t.contractDurationMonths}>
                Hợp đồng {t.contractDurationMonths} tháng: hoa hồng {t.commissionPercent}%
                {"commissionAmount" in c ? <> ({formatVnd(c.commissionAmount)})</> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-amber-950">Nhà này chưa có chính sách hoa hồng.</p>
      )}

      {bonus ? (
        <div className="mt-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Lì xì cho sale</h3>
          <p className="text-sm text-amber-950">
            {bonus.description} — <strong>{formatVnd(bonus.amount)}</strong>
            {" · "}
            {isBonusActiveToday(bonus.validFrom, bonus.validTo) ? "đang trong hạn" : "hết hạn / chưa tới hạn"}
            {" "}({bonus.validFrom} → {bonus.validTo})
          </p>
        </div>
      ) : null}

      <div className="mt-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
          Chính sách huỷ cọc (khách chủ động huỷ trước hạn)
        </h3>
        <p className="text-sm text-amber-950">
          Chủ nhà {cancel.landlordSharePercent}% — Sale {cancel.saleSharePercent}%, tính trên phần còn lại sau
          khi trừ tiền giữ chỗ theo số ngày đã giữ.
        </p>
        {cancel.note ? <p className="mt-1 text-xs text-amber-900">{cancel.note}</p> : null}
      </div>
    </section>
  );

  return (
    <RoomExportSheet
      room={toPublicRoom(fullRoom)}
      backHref={`/rooms/${fullRoom.id}`}
      banner={banner}
      internalSection={internalSection}
    />
  );
}
