"use client";

/**
 * Triggers the browser's native print dialog — the customer picks "Save as
 * PDF" as the destination themselves. No PDF-generation library needed: the
 * export page (/rooms/[id]/export) is just a print-optimized layout of the
 * same public room data, and this button is the only bit of interactivity
 * on an otherwise fully server-rendered page.
 */
export default function PrintButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      In / Lưu PDF
    </button>
  );
}
