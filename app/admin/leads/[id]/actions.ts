"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminContext, requireFirmAccess } from "@/lib/admin-context";

const VALID_STATUSES = ["new", "open", "contacted", "archived"] as const;

export async function setLeadWorkflowStatusAction(
  leadId: string,
  status: string,
): Promise<void> {
  const ctx = await getAdminContext();
  if (!ctx) throw new Error("Unauthorized");
  if (!(VALID_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid status");

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { firmId: true },
  });
  if (!lead) throw new Error("Lead not found");

  requireFirmAccess(ctx, lead.firmId);

  await prisma.lead.update({
    where: { id: leadId },
    data: { workflowStatus: status },
  });

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
}

const NOTE_MAX_LENGTH = 2000;

export async function addLeadNoteAction(leadId: string, content: string): Promise<void> {
  const ctx = await getAdminContext();
  if (!ctx) throw new Error("Unauthorized");

  const trimmed = content.trim();
  if (!trimmed) throw new Error("Note cannot be empty.");
  if (trimmed.length > NOTE_MAX_LENGTH)
    throw new Error(`Note must be ${NOTE_MAX_LENGTH} characters or fewer.`);

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { firmId: true } });
  if (!lead) throw new Error("Lead not found");
  requireFirmAccess(ctx, lead.firmId);

  await prisma.leadNote.create({ data: { leadId, authorId: ctx.sub, content: trimmed } });

  revalidatePath(`/admin/leads/${leadId}`);
}

export async function setLeadAssigneeAction(
  leadId: string,
  assignedToId: string | null,
): Promise<void> {
  const ctx = await getAdminContext();
  if (!ctx) throw new Error("Unauthorized");

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { firmId: true } });
  if (!lead) throw new Error("Lead not found");
  requireFirmAccess(ctx, lead.firmId);

  if (assignedToId !== null) {
    const assignee = await prisma.adminUser.findUnique({
      where: { id: assignedToId },
      select: { firmId: true, role: true, deactivatedAt: true },
    });
    if (!assignee) throw new Error("User not found");
    if (assignee.firmId !== lead.firmId) throw new Error("User does not belong to this firm");
    if (assignee.deactivatedAt) throw new Error("User is deactivated");
    if (assignee.role === "operator") throw new Error("Operators cannot be assigned to leads");
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { assignedToId, assignedAt: assignedToId !== null ? new Date() : null },
  });

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
}
