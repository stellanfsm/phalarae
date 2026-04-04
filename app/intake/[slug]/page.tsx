import { notFound } from "next/navigation";
import { IntakeWidget } from "@/components/intake/IntakeWidget";
import { prisma } from "@/lib/prisma";
import { resolveFirmDisplay } from "@/lib/firm-display";

export const dynamic = "force-dynamic";

export default async function IntakePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let firm;
  try {
    firm = await prisma.firm.findUnique({ where: { slug } });
  } catch (e) {
    console.error(e);
    const raw = e instanceof Error ? e.message : String(e);
    const supabaseAuth =
      raw.includes("Tenant or user not found") ||
      raw.includes("password authentication failed");
    const hint = supabaseAuth
      ? " Your Supabase database user or password does not match. In Supabase: Project → Connect → copy the full URI under Session pooler (or reset Database password under Project Settings → Database), paste it as DATABASE_URL in .env, then run npm run setup:db in a terminal."
      : " Check DATABASE_URL in .env (use the Session pooler URI from Supabase Project → Connect). Then run npm run setup:db.";
    const devTail =
      process.env.NODE_ENV === "development" ? ` [${raw.slice(0, 120)}]` : "";
    throw new Error(`Database connection failed.${hint}${devTail}`);
  }
  if (!firm) notFound();

  const r = resolveFirmDisplay(firm);

  return (
    <IntakeWidget
      firmSlug={firm.slug}
      firmDisplayName={r.firmName}
      primaryColor={r.primaryColor}
      disclaimerText={r.disclaimerText}
      logoUrl={r.logoUrl}
      urgentPhoneDisplay={r.urgentPhoneDisplay}
      urgentPhoneTel={r.urgentPhoneTel}
    />
  );
}
