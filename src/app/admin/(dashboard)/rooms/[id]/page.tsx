import { notFound } from "next/navigation";
import { getRoom, listProperties } from "@/lib/db";
import RoomForm from "@/components/RoomForm";

export const dynamic = "force-dynamic";

export default async function EditRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [room, properties] = await Promise.all([
    getRoom(id),
    listProperties({ includeInactive: true }),
  ]);
  if (!room) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">
        Sửa phòng {room.code}
      </h1>
      <RoomForm room={room} properties={properties} />
    </div>
  );
}
