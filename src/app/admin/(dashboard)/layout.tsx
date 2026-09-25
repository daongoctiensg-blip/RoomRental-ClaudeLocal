import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/admin" className="text-slate-900">
              Dashboard
            </Link>
            <Link href="/admin/properties/new" className="text-slate-500 hover:text-slate-800">
              + Nhà mới
            </Link>
            <Link href="/admin/rooms/new" className="text-slate-500 hover:text-slate-800">
              + Phòng mới
            </Link>
            <Link href="/admin/amenities" className="text-slate-500 hover:text-slate-800">
              Danh mục tiện ích
            </Link>
            <Link href="/" className="text-slate-500 hover:text-slate-800">
              Xem trang công khai
            </Link>
          </nav>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
