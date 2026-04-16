import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-token";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (token) {
      const payload = await verifyAdminToken(token);
      if (payload?.sessionId) {
        await prisma.adminSession.updateMany({
          where: { id: payload.sessionId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
  } catch {
    // Best-effort — session revocation failure must never block logout
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE_NAME);
  return res;
}
