import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { adminCookieOptions, signAdminToken, ADMIN_COOKIE_NAME } from "@/lib/admin-token";
import { prisma } from "@/lib/prisma";
import { clientIp, checkAdminLogin } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

const MAX_AGE_SEC = 60 * 60 * 12;

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const rl = await checkAdminLogin(ip);
  if (!rl.ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const emailNorm = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;

  let user;
  try {
    user = await prisma.adminUser.findUnique({ where: { email: emailNorm } });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
  if (!user || user.deactivatedAt !== null) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const userAgent = req.headers.get("user-agent") ?? undefined;

  let adminSession: { id: string };
  let token: string;
  try {
    [adminSession] = await prisma.$transaction([
      prisma.adminSession.create({
        data: {
          userId: user.id,
          expiresAt: new Date(Date.now() + MAX_AGE_SEC * 1000),
          ipAddress: ip,
          userAgent: userAgent ?? null,
        },
        select: { id: true },
      }),
      prisma.adminUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);
    token = await signAdminToken(
      {
        sub: user.id,
        email: user.email,
        firmId: user.firmId,
        role: user.role,
        sessionId: adminSession.id,
      },
      MAX_AGE_SEC,
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  void prisma.adminSession
    .deleteMany({
      where: {
        userId: user.id,
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
      },
    })
    .catch(() => {});

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, adminCookieOptions(MAX_AGE_SEC));
  return res;
}
