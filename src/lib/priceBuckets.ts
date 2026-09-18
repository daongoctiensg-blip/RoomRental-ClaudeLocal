// The 5 fixed price buckets from the PRD. `max: null` means "no upper bound".
export interface PriceBucket {
  key: string;
  label: string;
  min: number;
  max: number | null;
}

export const PRICE_BUCKETS: PriceBucket[] = [
  { key: "lt-3", label: "< 3 triệu", min: 0, max: 3_000_000 },
  { key: "3-4", label: "3 - 4 triệu", min: 3_000_000, max: 4_000_000 },
  { key: "4-5", label: "4 - 5 triệu", min: 4_000_000, max: 5_000_000 },
  { key: "5-6", label: "5 - 6 triệu", min: 5_000_000, max: 6_000_000 },
  { key: "gte-6", label: ">= 6 triệu", min: 6_000_000, max: null },
];

export function bucketByKey(key: string): PriceBucket | undefined {
  return PRICE_BUCKETS.find((b) => b.key === key);
}
