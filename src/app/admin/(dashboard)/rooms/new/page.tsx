import { listProperties } from "@/lib/db";
import RoomForm from "@/components/RoomForm";

export const dynamic = "force-dynamic";

export default async function NewRoomPage() {
  const properties = await listProperties({ includeInactive: true });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">Thêm phòng mới</h1>
      {properties.length === 0 ? (
        <p className="text-sm text-slate-500">
          Chưa có nhà nào — hãy tạo nhà trước khi thêm phòng.
        </p>
      ) : (
        <RoomForm properties={properties} />
      )}
    </div>
  );
}
