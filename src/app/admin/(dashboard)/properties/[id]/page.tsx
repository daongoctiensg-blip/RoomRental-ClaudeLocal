import { notFound } from "next/navigation";
import { getProperty } from "@/lib/db";
import PropertyForm from "@/components/PropertyForm";
import UtilityFeeEditor from "@/components/UtilityFeeEditor";

export const dynamic = "force-dynamic";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-slate-900">
        Sửa thông tin nhà — {property.name}
      </h1>
      <UtilityFeeEditor
        propertyId={property.id}
        versions={property.utilityFeeVersions}
      />
      <PropertyForm property={property} />
    </div>
  );
}
