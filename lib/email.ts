import { Resend } from "resend";
import type { QualificationTag, IntakePayload } from "@/lib/schemas/intake-data";
import { buildLeadEmailBody } from "@/lib/summary";

function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function incidentSubjectLabel(type: IntakePayload["incidentType"]): string {
  switch (type) {
    case "motor_vehicle": return "Motor vehicle";
    case "slip_fall": return "Slip / fall";
    case "workplace": return "Workplace injury";
    case "medical_malpractice": return "Medical malpractice";
    case "dog_bite": return "Dog bite";
    case "other": return "Other";
  }
}

export async function sendNewLeadAlert(params: {
  to: string;
  firmName: string;
  qualificationTag: QualificationTag;
  intake: IntakePayload;
  urgentSelfReported: boolean;
  submittedAt: Date;
  leadAdminUrl: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  const client = resend();
  if (!client) return { sent: false, error: "RESEND_API_KEY not configured" };

  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) return { sent: false, error: "RESEND_FROM_EMAIL not configured" };

  const urgentSuffix = params.urgentSelfReported ? " — Urgent" : "";
  const subject = `New lead — ${params.intake.fullName} — ${incidentSubjectLabel(params.intake.incidentType)}${urgentSuffix}`;

  const text = buildLeadEmailBody({
    firmName: params.firmName,
    qualificationTag: params.qualificationTag,
    intake: params.intake,
    urgentSelfReported: params.urgentSelfReported,
    submittedAt: params.submittedAt,
    leadAdminUrl: params.leadAdminUrl,
  });

  const { error } = await client.emails.send({
    from,
    to: params.to,
    subject,
    text,
  });

  if (error) return { sent: false, error: error.message };
  return { sent: true };
}

export async function sendInviteEmail(params: {
  to: string;
  firmName: string;
  role: "firm_admin" | "firm_staff";
  inviteUrl: string;
  inviterEmail: string;
}): Promise<{ sent: boolean; error?: string }> {
  const client = resend();
  if (!client) return { sent: false, error: "RESEND_API_KEY not configured" };

  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) return { sent: false, error: "RESEND_FROM_EMAIL not configured" };

  const roleLabel = params.role === "firm_admin" ? "firm admin" : "firm staff";
  const subject = `You've been invited to join ${params.firmName} on Phalerae`;
  const text = [
    `${params.inviterEmail} has invited you to join ${params.firmName} as a ${roleLabel} on Phalerae.`,
    "",
    "Accept your invite and set your password here:",
    params.inviteUrl,
    "",
    "This link expires in 72 hours. If you did not expect this invitation, you can ignore this email.",
  ].join("\n");

  const { error } = await client.emails.send({ from, to: params.to, subject, text });
  if (error) return { sent: false, error: error.message };
  return { sent: true };
}
