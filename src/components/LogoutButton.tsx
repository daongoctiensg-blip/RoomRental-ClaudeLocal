"use client";

import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch(apiUrl("/api/auth/logout"), { method: "POST" });
        router.push("/admin/login");
        router.refresh();
      }}
      className="text-sm font-medium text-slate-500 hover:text-slate-800"
    >
      Đăng xuất
    </button>
  );
}
