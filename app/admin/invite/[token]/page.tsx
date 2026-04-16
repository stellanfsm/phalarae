import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { AcceptInviteForm } from "@/components/admin/AcceptInviteForm";

function hashInviteToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export const dynamic = "force-dynamic";

function roleLabel(role: string): string {
  if (role === "firm_admin") return "firm admin";
  if (role === "firm_staff") return "firm staff";
  return role;
}

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.adminInvite.findUnique({
    where: { token: hashInviteToken(token) },
    select: {
      email: true,
      role: true,
      usedAt: true,
      expiresAt: true,
      firm: { select: { name: true } },
    },
  });

  if (!invite) {
    return (
      <InviteShell>
        <p className="text-sm text-[#334155]">
          This invite link is invalid or does not exist.
        </p>
      </InviteShell>
    );
  }

  if (invite.usedAt !== null) {
    return (
      <InviteShell>
        <p className="text-sm text-[#334155]">
          This invite has already been accepted. If you need access, ask an admin to send a new invite.
        </p>
      </InviteShell>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <InviteShell>
        <p className="text-sm text-[#334155]">
          This invite has expired. Please ask an admin to send a new one.
        </p>
      </InviteShell>
    );
  }

  return (
    <InviteShell>
      <p className="text-sm text-[#64748b]">
        You've been invited to join{" "}
        <span className="font-medium text-[#0f172a]">{invite.firm.name}</span> as a{" "}
        {roleLabel(invite.role)} on Phalerae.
      </p>
      <p className="mt-1 text-sm text-[#64748b]">
        Signing in as:{" "}
        <span className="font-mono text-xs text-[#475569]">{invite.email}</span>
      </p>
      <div className="mt-6">
        <AcceptInviteForm token={token} />
      </div>
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-[#e2e0d9] bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-[#0f172a]">Accept invite</h1>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
