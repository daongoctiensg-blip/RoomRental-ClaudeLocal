import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phòng cho thuê",
  description: "Danh sách phòng cho thuê còn trống, xem chi tiết và liên hệ đặt lịch xem phòng.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
