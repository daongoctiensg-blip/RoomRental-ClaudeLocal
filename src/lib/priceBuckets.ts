// Price buckets — round 9 (2026-09-24): re-derived from the original 5
// PRD-sourced buckets (<3/3-4/4-5/5-6/>=6 triệu, kept in git history) to a
// wider set that unifies with AI 2 (Gemini)'s own buckets (<5/5-7/7-10/>10
// triệu) per the owner's explicit request to have both platforms present
// the same price filter to customers. `max: null` means "no upper bound".
// If this ever needs revisiting again, re-derive from BOTH platforms' live
// room price distributions, not just one.
export interface PriceBucket {
  key: string;
  label: string;
  min: number;
  max: number | null;
}

export const PRICE_BUCKETS: PriceBucket[] = [
  { key: "lt-4", label: "< 4 triệu", min: 0, max: 4_000_000 },
  { key: "4-6", label: "4 - 6 triệu", min: 4_000_000, max: 6_000_000 },
  { key: "6-8", label: "6 - 8 triệu", min: 6_000_000, max: 8_000_000 },
  { key: "8-12", label: "8 - 12 triệu", min: 8_000_000, max: 12_000_000 },
  { key: "gte-12", label: ">= 12 triệu", min: 12_000_000, max: null },
];

export function bucketByKey(key: string): PriceBucket | undefined {
  return PRICE_BUCKETS.find((b) => b.key === key);
}
