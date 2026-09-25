import { listAmenitiesWithUsage } from "@/lib/amenityCatalog";
import AmenityCatalogManager from "@/components/AmenityCatalogManager";

export const dynamic = "force-dynamic";

// Admin page for the amenity master data — round 12. The dashboard layout
// already redirects non-admins to /admin/login.
export default async function AmenitiesAdminPage() {
  const amenities = await listAmenitiesWithUsage();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Danh mục tiện ích</h1>
        <p className="mt-1 text-sm text-slate-500">
          Danh sách tiện ích dùng chung cho mọi tòa nhà/phòng. Đổi tên ở đây sẽ tự cập nhật ở tất cả
          tòa nhà/phòng đang dùng. Tiện ích đánh dấu <strong>Phổ biến</strong> sẽ hiện ở bộ lọc trang
          chủ và làm tag nhanh trên thẻ phòng.
        </p>
      </div>
      <AmenityCatalogManager initial={amenities} />
    </div>
  );
}
