"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/** Round white "Chia sẻ" button on the mobile photo hero — native share
 * sheet where available, otherwise copies the link. */
export default function MobileShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // cancelled — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — nothing else to do
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? "Đã copy link" : "Chia sẻ"}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#16233b] shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
    >
      {copied ? <Check className="h-[18px] w-[18px]" aria-hidden /> : <Share2 className="h-[18px] w-[18px]" aria-hidden />}
    </button>
  );
}
