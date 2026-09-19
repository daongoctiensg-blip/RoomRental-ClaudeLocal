"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CommissionTier, Property, UtilityFeeVersion } from "@/types";

type FormState = {
  name: string;
  addressNew: string;
  addressOld: string;
  contactPhone: string;
  amenitiesShared: string; // newline-separated in the UI
  transportNotes: string; // newline-separated in the UI
  images: string; // newline-separated URLs
  depositAmount: number;
  holdDays: number;
  forfeitureRule: string;
  contractDepositMonths: number;
  promotionDescription: string;
  promotionValidFrom: string;
  promotionValidTo: string;
  electricityPricePerKwh: number;
  waterPricePerPerson: number;
  serviceFeePerMonth: number;
};

function currentFeeVersion(property?: Property) {
  const versions = property?.utilityFeeVersions ?? [];
  // Bản đang áp dụng = bản mới nhất có effectiveFrom <= hôm nay (đúng logic getCurrentUtilityFee trong db.ts)
  const today = new Date().toISOString().slice(0, 10);
  return versions
    .filter((v) => v.effectiveFrom <= today)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

function toFormState(property?: Property): FormState {
  const fee = currentFeeVersion(property);
  return {
    name: property?.name ?? "",
    addressNew: property?.addressNew ?? "",
    addressOld: property?.addressOld ?? "",
    contactPhone: property?.contactPhone ?? "",
    amenitiesShared: (property?.amenitiesShared ?? []).join("\n"),
    transportNotes: (property?.transportNotes ?? []).join("\n"),
    images: (property?.images ?? []).join("\n"),
    depositAmount: property?.depositPolicy.depositAmount ?? 2000000,
    holdDays: property?.depositPolicy.holdDays ?? 7,
    forfeitureRule: property?.depositPolicy.forfeitureRule ?? "",
    contractDepositMonths: property?.depositPolicy.contractDepositMonths ?? 1,
    promotionDescription: property?.promotion?.description ?? "",
    promotionValidFrom: property?.promotion?.validFrom ?? "",
    promotionValidTo: property?.promotion?.validTo ?? "",
    electricityPricePerKwh: fee?.electricityPricePerKwh ?? 0,
    waterPricePerPerson: fee?.waterPricePerPerson ?? 0,
    serviceFeePerMonth: fee?.serviceFeePerMonth ?? 0,
  };
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** So sánh giá trị nhập với bản giá đang áp dụng — chỉ gọi API tạo bản mới
 * khi thực sự có gì đổi, tránh tạo bản trùng lặp mỗi lần bấm Lưu. */
function feeChanged(current: UtilityFeeVersion | undefined, form: FormState) {
  const next = {
    electricityPricePerKwh: Number(form.electricityPricePerKwh),
    waterPricePerPerson: Number(form.waterPricePerPerson),
    serviceFeePerMonth: Number(form.serviceFeePerMonth),
  };
  const hasAnyValue =
    next.electricityPricePerKwh > 0 ||
    next.waterPricePerPerson > 0 ||
    next.serviceFeePerMonth > 0;
  if (!hasAnyValue) return null; // chưa nhập gì thì bỏ qua, không gọi API
  if (
    current &&
    current.electricityPricePerKwh === next.electricityPricePerKwh &&
    current.waterPricePerPerson === next.waterPricePerPerson &&
    current.serviceFeePerMonth === next.serviceFeePerMonth
  ) {
    return null; // không đổi gì so với bản hiện tại
  }
  return next;
}

export default function PropertyForm({ property }: { property?: Property }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(toFormState(property));
  const [commission, setCommission] = useState<CommissionTier[]>(
    property?.commissionPolicy ?? [
      { contractDurationMonths: 6, commissionPercent: 50 },
      { contractDurationMonths: 12, commissionPercent: 80 },
    ]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      addressNew: form.addressNew,
      addressOld: form.addressOld || undefined,
      contactPhone: form.contactPhone,
      amenitiesShared: splitLines(form.amenitiesShared),
      transportNotes: splitLines(form.transportNotes),
      images: splitLines(form.images),
      depositPolicy: {
        depositAmount: Number(form.depositAmount),
        holdDays: Number(form.holdDays),
        forfeitureRule: form.forfeitureRule,
        contractDepositMonths: Number(form.contractDepositMonths),
      },
      commissionPolicy: commission,
      promotion: form.promotionDescription
        ? {
            description: form.promotionDescription,
            validFrom: form.promotionValidFrom,
            validTo: form.promotionValidTo,
          }
        : undefined,
      isActive: property?.isActive ?? true,
      utilityFeeVersions: property?.utilityFeeVersions ?? [],
    };

    const url = property ? `/api/properties/${property.id}` : "/api/properties";
    const method = property ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setSaving(false);
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Có lỗi xảy ra");
      return;
    }

    // Phí điện/nước/dịch vụ là dữ liệu append-only (giữ lịch sử giá cũ) —
    // dùng đúng route riêng đã có sẵn cho việc này, không đè trực tiếp vào
    // property như các field khác.
    const data = await res.json();
    const savedId: string = property?.id ?? data.property.id;
    const newFee = feeChanged(currentFeeVersion(property), form);
    if (newFee) {
      const feeRes = await fetch(`/api/properties/${savedId}/utility-fees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newFee,
          effectiveFrom: new Date().toISOString().slice(0, 10),
        }),
      });
      if (!feeRes.ok) {
        setSaving(false);
        const feeData = await feeRes.json().catch(() => ({}));
        setError(feeData.error ?? "Lưu thông tin nhà OK nhưng lưu phí dịch vụ thất bại");
        return;
      }
    }

    setSaving(false);
    router.push("/admin");
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Section title="Thông tin chung">
        <Field label="Tên nhà (nội bộ)">
          <input
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Địa chỉ mới (theo phường)">
          <input
            required
            value={form.addressNew}
            onChange={(e) => update("addressNew", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Địa chỉ cũ (theo quận, không bắt buộc)">
          <input
            value={form.addressOld}
            onChange={(e) => update("addressOld", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Số điện thoại liên hệ">
          <input
            required
            value={form.contactPhone}
            onChange={(e) => update("contactPhone", e.target.value)}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Tiện ích & di chuyển (mỗi dòng 1 mục)">
        <Field label="Tiện ích chung">
          <textarea
            value={form.amenitiesShared}
            onChange={(e) => update("amenitiesShared", e.target.value)}
            rows={4}
            className={inputClass}
          />
        </Field>
        <Field label="Di chuyển / vị trí">
          <textarea
            value={form.transportNotes}
            onChange={(e) => update("transportNotes", e.target.value)}
            rows={4}
            className={inputClass}
          />
        </Field>
        <Field label="Ảnh nhà (mỗi dòng 1 URL)">
          <textarea
            value={form.images}
            onChange={(e) => update("images", e.target.value)}
            rows={3}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Phí dịch vụ (điện / nước / phí dịch vụ chung)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Điện (đ/kWh)">
            <input
              type="number"
              value={form.electricityPricePerKwh}
              onChange={(e) =>
                update("electricityPricePerKwh", Number(e.target.value))
              }
              className={inputClass}
            />
          </Field>
          <Field label="Nước (đ/người)">
            <input
              type="number"
              value={form.waterPricePerPerson}
              onChange={(e) =>
                update("waterPricePerPerson", Number(e.target.value))
              }
              className={inputClass}
            />
          </Field>
          <Field label="Phí dịch vụ (đ/tháng)">
            <input
              type="number"
              value={form.serviceFeePerMonth}
              onChange={(e) =>
                update("serviceFeePerMonth", Number(e.target.value))
              }
              className={inputClass}
            />
          </Field>
        </div>
        <p className="text-xs text-slate-400">
          Đổi số ở đây sẽ tạo 1 bản giá mới có hiệu lực từ hôm nay — bản giá
          cũ vẫn được giữ lại, không mất lịch sử.
        </p>
      </Section>

      <Section title="Chính sách cọc">
        <Field label="Số tiền giữ chỗ (VND)">
          <input
            type="number"
            value={form.depositAmount}
            onChange={(e) => update("depositAmount", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Số ngày giữ chỗ">
          <input
            type="number"
            value={form.holdDays}
            onChange={(e) => update("holdDays", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Số tháng tiền cọc khi ký hợp đồng">
          <input
            type="number"
            value={form.contractDepositMonths}
            onChange={(e) =>
              update("contractDepositMonths", Number(e.target.value))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Điều khoản mất cọc / chính sách (mô tả)">
          <textarea
            value={form.forfeitureRule}
            onChange={(e) => update("forfeitureRule", e.target.value)}
            rows={2}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Hoa hồng theo thời hạn hợp đồng">
        <div className="flex flex-col gap-2">
          {commission.map((tier, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="number"
                value={tier.contractDurationMonths}
                onChange={(e) =>
                  setCommission((list) =>
                    list.map((t, idx) =>
                      idx === i
                        ? { ...t, contractDurationMonths: Number(e.target.value) }
                        : t
                    )
                  )
                }
                className={`${inputClass} w-24`}
              />
              <span className="text-sm text-slate-500">tháng →</span>
              <input
                type="number"
                value={tier.commissionPercent}
                onChange={(e) =>
                  setCommission((list) =>
                    list.map((t, idx) =>
                      idx === i
                        ? { ...t, commissionPercent: Number(e.target.value) }
                        : t
                    )
                  )
                }
                className={`${inputClass} w-24`}
              />
              <span className="text-sm text-slate-500">%</span>
              <button
                type="button"
                onClick={() =>
                  setCommission((list) => list.filter((_, idx) => idx !== i))
                }
                className="text-xs text-red-500 hover:underline"
              >
                Xoá
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setCommission((list) => [
                ...list,
                { contractDurationMonths: 0, commissionPercent: 0 },
              ])
            }
            className="self-start text-xs font-medium text-[color:var(--color-accent)] hover:underline"
          >
            + Thêm mốc hoa hồng
          </button>
        </div>
      </Section>

      <Section title="Khuyến mãi (không bắt buộc)">
        <Field label="Mô tả">
          <input
            value={form.promotionDescription}
            onChange={(e) => update("promotionDescription", e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Từ ngày">
            <input
              type="date"
              value={form.promotionValidFrom}
              onChange={(e) => update("promotionValidFrom", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Đến ngày">
            <input
              type="date"
              value={form.promotionValidTo}
              onChange={(e) => update("promotionValidTo", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[color:var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--color-accent-dark)] disabled:opacity-60"
        >
          {saving ? "Đang lưu…" : "Lưu"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[color:var(--color-accent)] focus:outline-none";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
