"use client";

import { useState } from "react";

/**
 * Share + copy-phone buttons on the public room detail page — round 10,
 * §17. Pure UX addition, no business-rule involved. Uses the Web Share API
 * where available (mobile browsers, most desktop browsers) with a
 * copy-to-clipboard fallback everywhere else.
 */
export default function ShareButtons({ title, phone }: { title: string; phone: string }) {
  const [feedback, setFeedback] = useState<"share" | "phone" | null>(null);

  const flash = (which: "share" | "phone") => {
    setFeedback(which);
    setTimeout(() => setFeedback(null), 2000);
  };

  const onShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled the native share sheet, or it failed — fall
        // through to the clipboard fallback below rather than showing an
        // error for what's often just a cancel.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      flash("share");
    } catch {
      // Clipboard access denied — nothing more we can do without a paid
      // fallback service; the customer can still copy the URL manually.
    }
  };

  const onCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      flash("phone");
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-2 flex gap-2">
      <button
        type="button"
        onClick={onShare}
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        {feedback === "share" ? "Đã copy link!" : "🔗 Chia sẻ"}
      </button>
      <button
        type="button"
        onClick={onCopyPhone}
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        {feedback === "phone" ? "Đã copy SĐT!" : "📋 Copy SĐT"}
      </button>
    </div>
  );
}
