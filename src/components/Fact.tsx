import type { LucideIcon } from "lucide-react";

/**
 * Small icon + label + value stat, used across the room detail page (the
 * customer-facing tabs in RoomDetailTabs.tsx, and the admin-only "Nội bộ"
 * panel in src/app/rooms/[id]/page.tsx) — pulled out to its own file so
 * both can share one definition instead of drifting apart.
 */
export default function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon ? (
        <Icon className="mt-0.5 h-4 w-4 flex-none text-slate-400" aria-hidden />
      ) : null}
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
        <dd className="font-medium text-slate-800">{value}</dd>
      </div>
    </div>
  );
}
