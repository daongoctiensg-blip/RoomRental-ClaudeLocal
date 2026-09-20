import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

/** Returns true if the incoming request carries a valid admin session cookie. */
export function isAdminRequest(request: NextRequest): boolean {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

/** Same check as isAdminRequest, for use in Server Components / RSC pages
 * (the public site) that don't have a NextRequest to read — e.g. so the
 * public listing/detail pages can show extra internal info to a logged-in
 * admin (commission, lì xì, landlord contact, deposit-cancellation policy)
 * while a customer sees the normal public view. This reads the signed
 * session cookie server-side, so it cannot be spoofed from the browser. */
export async function isAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

/** Use at the top of any admin-only API route: `const denied = requireAdmin(req); if (denied) return denied;` */
export function requireAdmin(request: NextRequest): NextResponse | null {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
