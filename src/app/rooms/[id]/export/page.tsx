import { notFound } from "next/navigation";
import { getRoom, toPublicRoom } from "@/lib/db";
import { isAdminSession } from "@/lib/apiAuth";
import { isRoomPublic } from "@/lib/publicVisibility";
import RoomExportSheet from "@/components/export/RoomExportSheet";

export const dynamic = "force-dynamic";

/**
 * Print/PDF-export view of a room's public listing — confirmed scope
 * (from the owner's video + screenshot): a "Xuất PDF" button on the room
 * detail page opens this page, and the customer uses the browser's own
 * "Save as PDF" print destination. No PDF-generation library, no server
 * rendering to a binary — this route just lays the same data out in a
 * print-friendly way and calls window.print() (see <PrintButton>).
 *
 * IMPORTANT: this ALWAYS uses the public-safe shape (toPublicRoom), even
 * when an admin is the one opening it. The whole point of "cọc trong pdf
 * là cọc công khai" is that a PDF handed to a customer can never leak the
 * internal landlord/sale split — that must hold regardless of who
 * generated the PDF, so this page doesn't take the same "admin sees more"
 * branch the regular room detail page does.
 *
 * The sales-only copy (with commission / lì xì / cancellation split) is a
 * SEPARATE route, /rooms/[id]/export/internal, admin-gated — deliberately
 * not a flag on this page, so this code path has no way to print it.
 */
export default async function RoomExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [fullRoom, admin] = await Promise.all([getRoom(id), isAdminSession()]);
  if (!fullRoom) notFound();
  // Same visibility rule as the regular detail page: a deactivated room (or
  // one on a deactivated property) is unreachable by a non-admin, even via
  // this export route.
  // Round 15: guests can only export available rooms.
  if (!admin && !isRoomPublic(fullRoom)) notFound();

  return <RoomExportSheet room={toPublicRoom(fullRoom)} backHref={`/rooms/${fullRoom.id}`} />;
}
