"use client";

import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";

export default function LogoutButton({
  redirectTo = "/admin/login",
  className = "text-sm font-medium text-slate-500 hover:text-slate-800",
}: {
  /** Where to send the browser after logging out — /admin/login from inside
   * the admin area, but the current page (e.g. "/") when this button is
   * shown on the public site so an admin browsing it doesn't get bounced
   * into the admin login screen. */
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch(apiUrl("/api/auth/logout"), { method: "POST" });
        router.push(redirectTo);
        router.refresh();
      }}
      className={className}
    >
      Đăng xuất
    </button>
  );
}
