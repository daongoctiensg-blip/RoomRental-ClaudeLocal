import { ROOM_STATUS_LABEL, type RoomStatus } from "@/types";

const STYLES: Record<RoomStatus, string> = {
  available: "bg-green-100 text-green-800 border-green-300",
  deposited: "bg-amber-100 text-amber-800 border-amber-300",
  sold: "bg-gray-200 text-gray-700 border-gray-300",
  renovating: "bg-red-100 text-red-800 border-red-300",
};

export default function StatusBadge({ status }: { status: RoomStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}
    >
      {ROOM_STATUS_LABEL[status]}
    </span>
  );
}
