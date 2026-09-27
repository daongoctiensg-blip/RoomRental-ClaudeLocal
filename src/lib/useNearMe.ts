"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Location params replaced when switching to "near me" — the list and the
// map then show only rooms within NEARBY_RADIUS_KM of the visitor. `city`
// is left alone: the homepage ignores it while `near` is set.
const LOCATION_KEYS = ["ward", "district", "address", "near", "propertyId", "saved"];

/**
 * "Phòng gần tôi (2 km)" — round 14. Asks the browser for the visitor's
 * position (nothing is stored or sent anywhere except as the `near=lat,lng`
 * URL param of this same page) and navigates the homepage to it.
 */
export function useNearMe() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(
    (onDone?: () => void) => {
      setError(null);
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        setError("Trình duyệt không hỗ trợ lấy vị trí.");
        return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false);
          const params = new URLSearchParams(searchParams.toString());
          for (const k of LOCATION_KEYS) params.delete(k);
          params.set("near", `${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`);
          onDone?.();
          startTransition(() => router.push(`${pathname}?${params.toString()}`));
        },
        (err) => {
          setLocating(false);
          setError(
            err.code === err.PERMISSION_DENIED
              ? "Anh/chị chưa cho phép truy cập vị trí. Bật quyền vị trí cho trang này rồi thử lại."
              : "Không lấy được vị trí hiện tại. Thử lại sau."
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    },
    [pathname, router, searchParams]
  );

  const clear = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("near");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }, [pathname, router, searchParams]);

  return { locate, clear, locating, error };
}
