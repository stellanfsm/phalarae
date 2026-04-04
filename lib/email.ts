import { Resend } from "resend";
import type { QualificationTag } from "@/lib/schemas/intake-data";
import { buildLeadEmailBody } from "@/lib/summary";

function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendNewLeadAlert(params: {
  to: string;
  firmName: string;
  contactName: string;
  qualificationTag: QualificationTag;
  briefParagraph: string;
  humanSummary: string;
}): Promise<{ sent: boolean; error?: string }> {
  const client = resend();
  if (!client) return { sent: false, error: "RESEND_API_KEY not configured" };

  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) return { sent: false, error: "RESEND_FROM_EMAIL not configured" };

  const subject = `New Intake Lead – ${params.contactName} – ${params.qualificationTag}`;

  const text = buildLeadEmailBody({
    firmName: params.firmName,
    contactName: params.contactName,
    qualificationTag: params.qualificationTag,
    briefParagraph: params.briefParagraph,
    humanSummary: params.humanSummary,
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
