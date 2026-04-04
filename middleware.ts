import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-token";

const EMBED_HEADER = "x-phalerae-embed";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /* Lets root layout drop the default body background (iframe embeds looked like a grey slab). */
  if (pathname === "/embed" || pathname.startsWith("/embed/")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set(EMBED_HEADER, "1");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === "/admin" || pathname.startsWith("/admin/login")) return NextResponse.next();

  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  const session = await verifyAdminToken(token);
  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/embed", "/embed/:path*"],
};
