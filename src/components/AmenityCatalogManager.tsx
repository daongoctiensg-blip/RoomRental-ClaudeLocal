"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/basePath";
import {
  AMENITY_GROUPS,
  AMENITY_ICON_OPTIONS,
  type AmenityWithUsage,
  normalizeAmenityName,
} from "@/lib/amenities";
import { AmenityIcon } from "@/components/AmenityIcon";
import { useAlertDialog, useConfirm } from "@/components/dialogs/DialogProvider";

/** Admin table for the amenity catalog — round 12: rename (fixes typos
 * everywhere at once), re-group (drives the grouped amenity drawer on the
 * room detail page), pick an icon, toggle "phổ biến" (homepage filter + room
 * card quick tags), add, and delete unused items. Every change saves
 * immediately — there's no separate "Lưu" button to forget. */
export default function AmenityCatalogManager({ initial }: { initial: AmenityWithUsage[] }) {
  const [items, setItems] = useState(initial);
  const [newName, setNewName] = useState("");
  const [filter, setFilter] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const dropDraft = (id: string) =>
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  const confirm = useConfirm();
  const alertDialog = useAlertDialog();

  const visible = useMemo(() => {
    const q = normalizeAmenityName(filter);
    return items.filter((a) => !q || normalizeAmenityName(a.name).includes(q));
  }, [items, filter]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setSavingId(id);
    const res = await fetch(apiUrl(`/api/amenities/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setSavingId(null);
    if (!res.ok) {
      await alertDialog({ title: "Không lưu được", message: data.error ?? "Có lỗi xảy ra." });
      return false;
    }
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, ...data.amenity } : a)));
    return true;
  };

  const commitRename = async (id: string) => {
    const draft = drafts[id];
    const item = items.find((a) => a.id === id);
    if (draft === undefined || !item) return;
    if (draft.trim() === item.name) {
      dropDraft(id);
      return;
    }
    if (item.usageCount > 0) {
      const ok = await confirm({
        title: "Đổi tên tiện ích?",
        message: `"${item.name}" → "${draft.trim()}". Tên mới sẽ được cập nhật ở ${item.usageCount} tòa nhà/phòng đang dùng.`,
        confirmLabel: "Đổi tên",
      });
      if (!ok) return;
    }
    if (await patch(id, { name: draft })) {
      dropDraft(id);
    }
  };

  const add = async () => {
    if (!newName.trim()) return;
    const res = await fetch(apiUrl("/api/amenities"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await alertDialog({ title: "Không thêm được", message: data.error ?? "Có lỗi xảy ra." });
      return;
    }
    if (!data.created) {
      await alertDialog({
        title: "Đã có trong danh mục",
        message: `"${data.amenity.name}" đã có sẵn trong danh mục.`,
      });
    } else {
      setItems((prev) => [...prev, { ...data.amenity, usageCount: 0 }]);
    }
    setNewName("");
  };

  const remove = async (item: AmenityWithUsage) => {
    const ok = await confirm({
      title: "Xoá tiện ích?",
      message: `Xoá "${item.name}" khỏi danh mục?`,
      confirmLabel: "Xoá",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(apiUrl(`/api/amenities/${item.id}`), { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await alertDialog({ title: "Không xoá được", message: data.error ?? "Có lỗi xảy ra." });
      return;
    }
    setItems((prev) => prev.filter((a) => a.id !== item.id));
  };

  const cell = "px-3 py-2 align-middle";
  const select =
    "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-[color:var(--color-accent)] focus:outline-none";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder="Tên tiện ích mới (vd: Nhà không bị thấm nước)"
          className="min-w-[260px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void add()}
          className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-accent-dark)]"
        >
          <Plus className="h-4 w-4" aria-hidden /> Thêm
        </button>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Tìm trong danh mục…"
          className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className={cell}>Tên</th>
              <th className={cell}>Nhóm</th>
              <th className={cell}>Biểu tượng</th>
              <th className={`${cell} text-center`}>Phổ biến</th>
              <th className={`${cell} text-center`}>Đang dùng</th>
              <th className={cell}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((a) => (
              <tr key={a.id} className={savingId === a.id ? "opacity-60" : ""}>
                <td className={cell}>
                  <input
                    value={drafts[a.id] ?? a.name}
                    onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
                    onBlur={() => void commitRename(a.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === "Escape") {
                        dropDraft(a.id);
                      }
                    }}
                    aria-label={`Tên tiện ích ${a.name}`}
                    className="w-full rounded-md border border-transparent px-2 py-1 hover:border-slate-200 focus:border-[color:var(--color-accent)] focus:outline-none"
                  />
                </td>
                <td className={cell}>
                  <select
                    value={a.group}
                    onChange={(e) => void patch(a.id, { group: e.target.value })}
                    className={select}
                    aria-label={`Nhóm của ${a.name}`}
                  >
                    {AMENITY_GROUPS.map((g) => (
                      <option key={g.key} value={g.key}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={cell}>
                  <div className="flex items-center gap-2">
                    <AmenityIcon icon={a.icon} className="h-4 w-4 text-slate-600" />
                    <select
                      value={a.icon}
                      onChange={(e) => void patch(a.id, { icon: e.target.value })}
                      className={select}
                      aria-label={`Biểu tượng của ${a.name}`}
                    >
                      {AMENITY_ICON_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className={`${cell} text-center`}>
                  <input
                    type="checkbox"
                    checked={a.isPopular}
                    onChange={(e) => void patch(a.id, { isPopular: e.target.checked })}
                    aria-label={`${a.name} là tiện ích phổ biến`}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </td>
                <td className={`${cell} text-center text-slate-600`}>{a.usageCount}</td>
                <td className={`${cell} text-right`}>
                  <button
                    type="button"
                    onClick={() => void remove(a)}
                    disabled={a.usageCount > 0}
                    title={
                      a.usageCount > 0
                        ? "Đang được dùng — bỏ chọn ở tòa nhà/phòng trước rồi mới xoá được"
                        : "Xoá"
                    }
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  Không có tiện ích nào.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
