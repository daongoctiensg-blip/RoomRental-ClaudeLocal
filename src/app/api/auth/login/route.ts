import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_MAX_AGE_SECONDS,
  ADMIN_COOKIE_NAME,
  checkLoginRateLimit,
  checkPassword,
  createSessionToken,
  getLoginRetryAfterSeconds,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "@/lib/auth";

// Best-effort client IP extraction. x-forwarded-for can hold a comma-
// separated chain ("client, proxy1, proxy2") when multiple proxies are
// involved — the first entry is the original client. This is only used to
// bucket the login rate limiter, not as a security-sensitive identity
// check, so a spoofed header merely gives an attacker their own bucket
// rather than bypassing the limit entirely.
function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  if (!checkLoginRateLimit(ip)) {
    const retryAfter = getLoginRetryAfterSeconds(ip);
    return NextResponse.json(
      {
        error: `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(
          retryAfter / 60
        )} phút.`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const body = await request.json().catch(() => null);
  const password = body?.password;

  if (typeof password !== "string" || !checkPassword(password)) {
    recordFailedLogin(ip);
    return NextResponse.json({ error: "Sai mật khẩu" }, { status: 401 });
  }

  recordSuccessfulLogin(ip);
  const token = createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
