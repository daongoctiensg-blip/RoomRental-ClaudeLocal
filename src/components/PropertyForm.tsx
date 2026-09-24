"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import vnProvinces from "@/data/vn-provinces.json";
import vnWards from "@/data/vn-wards.json";
import vnHcmDistricts from "@/data/vn-hcm-districts.json";
import SearchableSelect from "@/components/SearchableSelect";
import type { CommissionTier, Property, UtilityFeeVersion } from "@/types";

type FormState = {
  name: string;
  addressNew: string;
  addressOld: string;
  city: string;
  ward: string;
  district: string;
  contactPhone: string;
  landlordName: string;
  landlordContactPhone: string;
  landlordZalo: string;
  amenitiesShared: string; // newline-separated in the UI
  transportNotes: string; // newline-separated in the UI
  images: string; // newline-separated URLs
  holdAmount: number;
  holdDays: number;
  securityDepositMonths: number;
  prepaidRentMonths: number;
  customerNote: string;
  cancellationLandlordPercent: number;
  cancellationSalePercent: number;
  cancellationNote: string;
  bonusDescription: string;
  bonusAmount: number;
  bonusValidFrom: string;
  bonusValidTo: string;
  customerPromotion: string;
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
    city: property?.city ?? "",
    ward: property?.ward ?? "",
    district: property?.district ?? "",
    contactPhone: property?.contactPhone ?? "",
    landlordName: property?.landlordName ?? "",
    landlordContactPhone: property?.landlordContactPhone ?? "",
    landlordZalo: property?.landlordZalo ?? "",
    amenitiesShared: (property?.amenitiesShared ?? []).join("\n"),
    transportNotes: (property?.transportNotes ?? []).join("\n"),
    images: (property?.images ?? []).join("\n"),
    holdAmount: property?.depositPolicy.holdAmount ?? 2000000,
    holdDays: property?.depositPolicy.holdDays ?? 7,
    securityDepositMonths: property?.depositPolicy.securityDepositMonths ?? 1,
    prepaidRentMonths: property?.depositPolicy.prepaidRentMonths ?? 1,
    customerNote: property?.depositPolicy.customerNote ?? "",
    cancellationLandlordPercent: property?.depositCancellationPolicy.landlordSharePercent ?? 50,
    cancellationSalePercent: property?.depositCancellationPolicy.saleSharePercent ?? 50,
    cancellationNote: property?.depositCancellationPolicy.note ?? "",
    bonusDescription: property?.saleBonusPolicy?.description ?? "",
    bonusAmount: property?.saleBonusPolicy?.amount ?? 0,
    bonusValidFrom: property?.saleBonusPolicy?.validFrom ?? "",
    bonusValidTo: property?.saleBonusPolicy?.validTo ?? "",
    customerPromotion: property?.customerPromotion ?? "",
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
  const provinceCodeByName = useMemo(
    () => new Map(vnProvinces.map((p) => [p.name, p.code])),
    []
  );
  const wardsForCity = useMemo(() => {
    const code = provinceCodeByName.get(form.city);
    if (!code) return [];
    return vnWards.filter((w) => w.pc === code).map((w) => w.w);
  }, [provinceCodeByName, form.city]);
  const cityOptions = useMemo(
    () => vnProvinces.map((p) => ({ value: p.name, label: p.name })),
    []
  );
  const wardOptions = useMemo(
    () => wardsForCity.map((w) => ({ value: w, label: w })),
    [wardsForCity]
  );
  const districtOptions = useMemo(
    () => vnHcmDistricts.map((d) => ({ value: d, label: d })),
    []
  );
  const [commission, setCommission] = useState<CommissionTier[]>(
    property?.commissionPolicy ?? [
      { contractDurationMonths: 6, commissionPercent: 50 },
      { contractDurationMonths: 12, commissionPercent: 80 },
    ]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // cho phép chọn lại đúng file đó lần sau
    if (!files.length) return;

    setUploading(true);
    setUploadError(null);
    const uploadedUrls: string[] = [];
    for (const file of files) {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(apiUrl("/api/upload"), { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(data.error ?? `Tải lên "${file.name}" thất bại`);
        continue; // vẫn thử các file còn lại, không dừng cả loạt vì 1 file lỗi
      }
      uploadedUrls.push(data.url as string);
    }
    setUploading(false);
    if (uploadedUrls.length) {
      update(
        "images",
        [form.images.trim(), ...uploadedUrls].filter(Boolean).join("\n")
      );
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      addressNew: form.addressNew,
      addressOld: form.addressOld || undefined,
      city: form.city,
      ward: form.ward,
      district: form.district,
      contactPhone: form.contactPhone,
      landlordName: form.landlordName || undefined,
      landlordContactPhone: form.landlordContactPhone || undefined,
      landlordZalo: form.landlordZalo || undefined,
      amenitiesShared: splitLines(form.amenitiesShared),
      transportNotes: splitLines(form.transportNotes),
      images: splitLines(form.images),
      depositPolicy: {
        holdAmount: Number(form.holdAmount),
        holdDays: Number(form.holdDays),
        securityDepositMonths: Number(form.securityDepositMonths),
        prepaidRentMonths: Number(form.prepaidRentMonths),
        customerNote: form.customerNote || undefined,
      },
      depositCancellationPolicy: {
        landlordSharePercent: Number(form.cancellationLandlordPercent),
        saleSharePercent: Number(form.cancellationSalePercent),
        note: form.cancellationNote || undefined,
      },
      commissionPolicy: commission,
      saleBonusPolicy: form.bonusDescription
        ? {
            description: form.bonusDescription,
            amount: Number(form.bonusAmount),
            validFrom: form.bonusValidFrom,
            validTo: form.bonusValidTo,
          }
        : undefined,
      customerPromotion: form.customerPromotion.trim() || undefined,
      isActive: property?.isActive ?? true,
      utilityFeeVersions: property?.utilityFeeVersions ?? [],
    };

    const url = apiUrl(property ? `/api/properties/${property.id}` : "/api/properties");
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
      const feeRes = await fetch(apiUrl(`/api/properties/${savedId}/utility-fees`), {
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
        <Field label="Thành phố / Tỉnh (dùng cho bộ lọc dropdown trên trang khách)">
          <SearchableSelect
            value={form.city}
            onChange={(v) => {
              update("city", v);
              update("ward", ""); // đổi tỉnh thì phường/xã cũ không còn hợp lệ nữa
            }}
            options={cityOptions}
            placeholder="Gõ để tìm thành phố / tỉnh…"
            className={inputClass}
          />
        </Field>
        <Field label="Phường / Xã (dùng cho bộ lọc dropdown trên trang khách)">
          <SearchableSelect
            value={form.ward}
            onChange={(v) => update("ward", v)}
            options={wardOptions}
            disabled={!form.city}
            placeholder={form.city ? "Gõ để tìm phường / xã…" : "Chọn thành phố/tỉnh trước"}
            className={inputClass}
          />
        </Field>
        <Field label="Quận / Huyện (theo địa chỉ cũ — dùng cho bộ lọc dropdown trên trang khách)">
          <SearchableSelect
            value={form.district}
            onChange={(v) => update("district", v)}
            options={districtOptions}
            placeholder="Gõ để tìm quận / huyện…"
            className={inputClass}
          />
        </Field>
        <Field label="Số điện thoại liên hệ (công khai — khách gọi/Zalo số này)">
          <input
            required
            value={form.contactPhone}
            onChange={(e) => update("contactPhone", e.target.value)}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Thông tin chủ nhà (nội bộ — KHÔNG hiện cho khách)">
        <Field label="Tên chủ nhà">
          <input
            value={form.landlordName}
            onChange={(e) => update("landlordName", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="SĐT chủ nhà (để gọi hỏi còn phòng / báo có khách tới)">
          <input
            value={form.landlordContactPhone}
            onChange={(e) => update("landlordContactPhone", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Zalo chủ nhà (nếu khác số điện thoại)">
          <input
            value={form.landlordZalo}
            onChange={(e) => update("landlordZalo", e.target.value)}
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
          <div className="mt-1 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={onPickFiles}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-[color:var(--color-accent)] disabled:opacity-60"
            >
              {uploading ? "Đang tải lên…" : "📷 Tải ảnh lên từ máy"}
            </button>
            {uploadError ? (
              <span className="text-xs text-red-600">{uploadError}</span>
            ) : null}
          </div>
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

      <Section title="Chính sách cọc (khách nhìn thấy)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cọc giữ phòng (VND) — đóng trước khi quyết định">
            <input
              type="number"
              min={0}
              value={form.holdAmount}
              onChange={(e) => update("holdAmount", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Thời hạn giữ cọc (số ngày)">
            <input
              type="number"
              min={1}
              value={form.holdDays}
              onChange={(e) => update("holdDays", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Giá trị cọc khi ký hợp đồng (tháng tiền thuê)">
            <input
              type="number"
              min={0}
              value={form.securityDepositMonths}
              onChange={(e) => update("securityDepositMonths", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Thanh toán trước khi ký (tháng tiền thuê)">
            <input
              type="number"
              min={0}
              value={form.prepaidRentMonths}
              onChange={(e) => update("prepaidRentMonths", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Ghi chú ngắn hiển thị cho khách (vd: giữ 7 ngày nếu không quay lại mất cọc)">
          <textarea
            value={form.customerNote}
            onChange={(e) => update("customerNote", e.target.value)}
            rows={2}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Chính sách huỷ cọc (nội bộ — KHÔNG hiện cho khách)">
        <p className="text-xs text-slate-400">
          Áp dụng khi khách chủ động huỷ cọc TRƯỚC khi hết hạn giữ phòng: chủ
          nhà giữ lại phần tương ứng số ngày đã giữ (tiền giữ chỗ ÷ số ngày
          giữ × số ngày đã qua), phần còn lại chia theo tỉ lệ dưới đây. Nếu
          khách không quay lại (hết hạn tự động), chủ nhà giữ toàn bộ, không
          chia theo tỉ lệ này.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Phần còn lại — chủ nhà (%)">
            <input
              type="number"
              min={0}
              max={100}
              value={form.cancellationLandlordPercent}
              onChange={(e) =>
                update("cancellationLandlordPercent", Number(e.target.value))
              }
              className={inputClass}
            />
          </Field>
          <Field label="Phần còn lại — sale (%)">
            <input
              type="number"
              min={0}
              max={100}
              value={form.cancellationSalePercent}
              onChange={(e) =>
                update("cancellationSalePercent", Number(e.target.value))
              }
              className={inputClass}
            />
          </Field>
        </div>
        {Number(form.cancellationLandlordPercent) + Number(form.cancellationSalePercent) !== 100 ? (
          <p className="text-xs text-amber-600">
            Lưu ý: 2 tỉ lệ trên cộng lại nên bằng 100% (hiện đang là{" "}
            {Number(form.cancellationLandlordPercent) + Number(form.cancellationSalePercent)}%).
          </p>
        ) : null}
        <Field label="Ghi chú thêm (nội bộ)">
          <textarea
            value={form.cancellationNote}
            onChange={(e) => update("cancellationNote", e.target.value)}
            rows={2}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Hoa hồng theo thời hạn hợp đồng (nội bộ)">
        <p className="text-xs text-slate-400">
          % tính trên 1 tháng tiền thuê của phòng, không phải trên tổng giá
          trị hợp đồng.
        </p>
        <div className="flex flex-col gap-2">
          {commission.map((tier, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="number"
                min={1}
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
                min={0}
                max={100}
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
                disabled={commission.length <= 1}
                title={
                  commission.length <= 1
                    ? "Cần giữ lại ít nhất 1 mốc hoa hồng"
                    : undefined
                }
                className="text-xs text-red-500 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
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

      <Section title="Lì xì / thưởng cho sale (nội bộ — không bắt buộc)">
        <Field label="Mô tả">
          <input
            value={form.bonusDescription}
            onChange={(e) => update("bonusDescription", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Số tiền (VND)">
          <input
            type="number"
            value={form.bonusAmount}
            onChange={(e) => update("bonusAmount", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Từ ngày">
            <input
              type="date"
              value={form.bonusValidFrom}
              onChange={(e) => update("bonusValidFrom", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Đến ngày">
            <input
              type="date"
              value={form.bonusValidTo}
              onChange={(e) => update("bonusValidTo", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <Section title="Khuyến mãi cho khách (công khai — hiện cho khách xem)">
        <p className="-mt-1 text-xs text-slate-400">
          Khác hoàn toàn với lì xì cho sale ở trên (mục đó luôn ẩn khách).
          Nội dung ở đây admin gõ gì thì hiện y vậy cho khách xem trên trang
          chi tiết phòng và bản xuất PDF. Để trống nếu không có khuyến mãi.
        </p>
        <Field label="Nội dung khuyến mãi">
          <textarea
            value={form.customerPromotion}
            onChange={(e) => update("customerPromotion", e.target.value)}
            rows={3}
            placeholder='Ví dụ: "Ký hợp đồng từ 12 tháng, tặng ngay 1 tháng phí dịch vụ."'
            className={inputClass}
          />
        </Field>
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
