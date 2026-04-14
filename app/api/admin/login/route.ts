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
      {
        error:
          "Cannot reach database. Fix DATABASE_URL (try Supabase Session pooler from Project → Connect), then run npm run setup:db.",
      },
      { status: 503 },
    );
  }
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  let token: string;
  try {
    token = await signAdminToken({ sub: user.id, email: user.email }, MAX_AGE_SEC);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, adminCookieOptions(MAX_AGE_SEC));
  return res;
}
