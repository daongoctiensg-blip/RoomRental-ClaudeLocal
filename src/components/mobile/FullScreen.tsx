"use client";

import { useEffect } from "react";

/** Full-screen mobile layer (search, filters, map) — round 13. Locks the
 * page behind it from scrolling and closes on Escape. */
export default function FullScreen({
  label,
  onClose,
  children,
  className = "",
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={`fixed inset-0 z-[1000] flex flex-col bg-white text-[#16233b] ${className}`}
    >
      {children}
    </div>
  );
}
