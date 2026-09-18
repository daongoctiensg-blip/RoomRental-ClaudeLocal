export default function RoomPhoto({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  if (src) {
    // Using a plain <img> on purpose: room photos are admin-entered arbitrary
    // URLs (or later, uploaded files served from the VPS), not known at build
    // time, so next/image's remote-pattern allowlist would need constant
    // upkeep for no real benefit here.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} loading="lazy" />;
  }

  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500 ${className ?? ""}`}
    >
      <span className="text-xs px-2 text-center">Chưa có ảnh</span>
    </div>
  );
}
