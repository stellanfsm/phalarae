import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyIntakeDefaults,
  assistantPromptForField,
  firstMissingField,
  FLOW_SEQUENCE,
  intakeProgressHints,
  intakeProgressLabel,
  isFlowStepKey,
  type FlowStep,
} from "@/lib/intake-steps";
import { buildForceAcceptedValue, isForceAcceptValueValid } from "@/lib/intake-force-accept";
import {
  fieldSupportsForceAccept,
  MAX_CLARIFY_ROUNDS_BEFORE_FORCE,
  mergeSessionStoredData,
  splitSessionStoredData,
} from "@/lib/intake-session-meta";
import { interpretIntakeTurn, type LlmTurnResult } from "@/lib/openai-intake";
import type { ParsedFieldUpdate } from "@/lib/intake-parse-field";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { qualifyIntake } from "@/lib/qualify";
import { clientIp, checkIntakeStart, checkIntakeAcknowledge, checkIntakeMessage } from "@/lib/rate-limit";
import { intakePayloadSchema, type IntakePayload } from "@/lib/schemas/intake-data";
import type { Firm } from "@/app/generated/prisma/client";
import { resolveFirmDisplay, resolveLeadAlertEmail } from "@/lib/firm-display";
import { buildHumanSummary, buildSummaryJson } from "@/lib/summary";
import { sendNewLeadAlert } from "@/lib/email";

function openingMessagesForFirm(firm: Firm) {
  const r = resolveFirmDisplay(firm);

  const customGreeting = r.greetingMessage?.trim();
  const lines = [`Thank you for contacting ${r.firmName}.`, ""];
  if (customGreeting) {
    lines.push(customGreeting, "");
  }
  lines.push(
    "I'm an automated intake assistant — not a lawyer. I can't provide legal advice.",
    "This conversation does not create an attorney–client relationship. Only a licensed attorney can evaluate your matter.",
    "If you are having a medical or safety emergency, call 911 (or your local emergency number) right away.",
  );
  return { greeting: lines.join("\n"), disclaimer: r.disclaimerText.trim() };
}

function closingMessageForFirm(firm: Firm, opts: { urgentYes: boolean }): string {
  const r = resolveFirmDisplay(firm);
  const firmName = r.firmName.trim() || r.firmName;
  const urgentPhoneDisplay = r.urgentPhoneDisplay;

  const lines = [
    "Thank you — your information has been received.",
    "",
    `A member of ${firmName} will review your case and contact you shortly.`,
  ];
  if (opts.urgentYes) {
    if (urgentPhoneDisplay) {
      lines.push("", `Because you indicated this may be urgent, we recommend calling the office directly: ${urgentPhoneDisplay}.`);
    } else {
      lines.push("", "Because you indicated this may be urgent, our team will prioritize your submission and contact you as soon as possible.");
    }
  } else if (urgentPhoneDisplay) {
    lines.push("", `To reach the office: ${urgentPhoneDisplay}.`);
  }
  lines.push("", "Not legal advice. Emergencies: call 911.");
  return lines.join("\n");
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), firmSlug: z.string().min(1).max(64) }),
  z.object({ action: z.literal("acknowledge_disclaimer"), sessionId: z.string().min(1) }),
  z.object({
    action: z.literal("message"),
    sessionId: z.string().min(1),
    text: z.string().min(1).max(8000),
  }),
  z.object({ action: z.literal("resume"), sessionId: z.string().min(1), firmSlug: z.string().min(1) }),
]);

function rateLimitHeaders(retryAfter?: number): HeadersInit {
  if (retryAfter != null) return { "Retry-After": String(retryAfter) };
  return {};
}

export async function POST(req: Request) {
  const ip = clientIp(req.headers);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const body = parsed.data;

  let rl;
  if (body.action === "start") {
    rl = await checkIntakeStart(ip);
  } else if (body.action === "acknowledge_disclaimer" || body.action === "resume") {
    rl = await checkIntakeAcknowledge(ip);
  } else {
    rl = await checkIntakeMessage(ip, body.sessionId);
  }
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You've sent too many messages. Please wait a moment and try again." },
      { status: 429, headers: rateLimitHeaders(rl.retryAfterSec) },
    );
  }

  try {
    if (body.action === "start") {
      const firm = await prisma.firm.findUnique({ where: { slug: body.firmSlug } });
      if (!firm) {
        return NextResponse.json({ error: "Firm not found" }, { status: 404 });
      }
      if (firm.status !== "active") {
        return NextResponse.json({ error: "This intake is not currently available." }, { status: 503 });
      }

      const session = await prisma.intakeSession.create({
        data: {
          firmId: firm.id,
          currentStep: "disclaimer",
          data: {},
        },
      });

      const { greeting, disclaimer } = openingMessagesForFirm(firm);

      await prisma.intakeMessage.createMany({
        data: [
          { sessionId: session.id, role: "assistant", content: greeting },
          { sessionId: session.id, role: "assistant", content: disclaimer },
        ],
      });

      const messages = await prisma.intakeMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      });

      return NextResponse.json(
        {
          sessionId: session.id,
          messages,
          currentStep: session.currentStep,
          done: false,
          progress: intakeProgressLabel({}),
          progressHints: [],
        },
        { headers: rateLimitHeaders() },
      );
    }

    if (body.action === "acknowledge_disclaimer") {
      const session = await prisma.intakeSession.findUnique({
        where: { id: body.sessionId },
        include: { firm: true },
      });
      if (!session || session.completedAt) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      if (session.currentStep !== "disclaimer") {
        return NextResponse.json({ error: "Disclaimer already acknowledged" }, { status: 400 });
      }

      const first = firstMissingField({});
      if (!first) {
        return NextResponse.json({ error: "Invalid flow configuration" }, { status: 500 });
      }
      const prompt = assistantPromptForField(first);

      await prisma.intakeMessage.create({
        data: {
          sessionId: session.id,
          role: "user",
          content: "I have read and understand the notice.",
          meta: { type: "disclaimer_ack" },
        },
      });
      await prisma.intakeMessage.create({
        data: { sessionId: session.id, role: "assistant", content: prompt },
      });

      await prisma.intakeSession.update({
        where: { id: session.id },
        data: { currentStep: first },
      });

      const messages = await prisma.intakeMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      });

      const progress = intakeProgressLabel({});

      return NextResponse.json(
        {
          sessionId: session.id,
          messages,
          currentStep: first,
          done: false,
          progress,
          progressHints: intakeProgressHints({}),
        },
        { headers: rateLimitHeaders() },
      );
    }

    if (body.action === "resume") {
      const RESUME_WINDOW_MS = 2 * 60 * 60 * 1000;
      const resumeSession = await prisma.intakeSession.findUnique({
        where: { id: body.sessionId },
        include: {
          firm: true,
          messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } },
        },
      });
      if (
        !resumeSession ||
        resumeSession.firm.slug !== body.firmSlug ||
        resumeSession.completedAt ||
        resumeSession.currentStep === "complete" ||
        resumeSession.firm.status !== "active" ||
        Date.now() - resumeSession.updatedAt.getTime() > RESUME_WINDOW_MS
      ) {
        return NextResponse.json({ resume: false }, { headers: rateLimitHeaders() });
      }
      const { payload: resumedPayload } = splitSessionStoredData(resumeSession.data);
      const resumeProgress =
        resumeSession.currentStep !== "disclaimer"
          ? intakeProgressLabel(resumedPayload)
          : null;
      const resumeHints = resumeProgress ? intakeProgressHints(resumedPayload) : [];
      return NextResponse.json(
        {
          resume: true,
          sessionId: resumeSession.id,
          messages: resumeSession.messages,
          currentStep: resumeSession.currentStep,
          done: false,
          progress: resumeProgress,
          progressHints: resumeHints,
        },
        { headers: rateLimitHeaders() },
      );
    }

    // message
    const session = await prisma.intakeSession.findUnique({
      where: { id: body.sessionId },
      include: { firm: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.completedAt) {
      return NextResponse.json({ done: true, alreadyCompleted: true });
    }

    if (session.currentStep === "disclaimer") {
      return NextResponse.json(
        { error: "Please acknowledge the disclaimer first" },
        { status: 400 },
      );
    }

    const step = session.currentStep;
    if (step === "complete") {
      return NextResponse.json({ error: "Session already completed" }, { status: 400 });
    }

    // LEGACY COMPAT: sessions that were waiting at "preferredContact" before it
    // was removed from FLOW_SEQUENCE. Apply the Zod default and complete.
    if (step === "preferredContact") {
      await prisma.intakeMessage.create({
        data: { sessionId: session.id, role: "user", content: body.text, meta: { step: "preferredContact", raw: body.text } },
      });
      const { payload: legacyPayload, meta: legacyMeta } = splitSessionStoredData(session.data);
      const legacyData: Partial<IntakePayload> = applyIntakeDefaults({ ...legacyPayload, preferredContact: "either" as const });
      const nextMissingLegacy = firstMissingField(legacyData);
      if (nextMissingLegacy) {
        const followUp = assistantPromptForField(nextMissingLegacy);
        legacyMeta.lastPromptByField[nextMissingLegacy] = followUp;
        await prisma.intakeMessage.create({ data: { sessionId: session.id, role: "assistant", content: followUp } });
        await prisma.intakeSession.update({ where: { id: session.id }, data: { currentStep: nextMissingLegacy, data: mergeSessionStoredData(legacyData, legacyMeta) as object } });
        const msgs = await prisma.intakeMessage.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: "asc" }, select: { role: true, content: true } });
        return NextResponse.json({ sessionId: session.id, messages: msgs, currentStep: nextMissingLegacy, done: false, progress: intakeProgressLabel(legacyData), progressHints: intakeProgressHints(legacyData) }, { headers: rateLimitHeaders() });
      }
      const legacyFull = intakePayloadSchema.parse(legacyData);
      const legacyQuality = legacyMeta.forceAcceptedFields.length > 0
        ? { forceAcceptedFields: [...legacyMeta.forceAcceptedFields], notes: legacyMeta.qualityRequiresReview ? ["One or more answers were accepted after repeated clarification — please verify."] : undefined }
        : undefined;
      const legacyTag = qualifyIntake(legacyFull, { qualityRequiresReview: legacyMeta.qualityRequiresReview });
      const legacyNow = new Date();
      const legacySummaryJson = buildSummaryJson(legacyFull, legacyTag, legacyNow, legacyQuality);
      const legacyHumanSummary = buildHumanSummary(legacyFull, legacyTag, legacyNow, legacyQuality);
      const legacyResolved = resolveFirmDisplay(session.firm);
      const legacyClosing = closingMessageForFirm(session.firm, { urgentYes: legacyFull.urgent === "yes" });
      const [, legacyLead] = await prisma.$transaction([
        prisma.intakeSession.update({ where: { id: session.id }, data: { data: mergeSessionStoredData(legacyData, legacyMeta) as object, currentStep: "complete", completedAt: legacyNow } }),
        prisma.lead.create({ data: { firmId: session.firmId, intakeSessionId: session.id, qualificationTag: legacyTag, summaryJson: legacySummaryJson as Prisma.InputJsonValue, humanSummary: legacyHumanSummary, contactName: legacyFull.fullName, contactEmail: legacyFull.email, contactPhone: legacyFull.phone } }),
        prisma.intakeMessage.create({ data: { sessionId: session.id, role: "assistant", content: legacyClosing } }),
      ]);
      const legacyTo = resolveLeadAlertEmail(session.firm)?.trim() || process.env.LEAD_ALERT_EMAIL?.trim() || null;
      let legacyAlertStatus = "no_recipient";
      let legacyAlertError: string | undefined;
      if (legacyTo) {
        try {
          const legacyProto = req.headers.get("x-forwarded-proto") ?? "https";
          const legacyHost = req.headers.get("host") ?? "";
          const legacyLeadAdminUrl = legacyHost ? `${legacyProto}://${legacyHost}/admin/leads/${legacyLead.id}` : null;
          const r = await sendNewLeadAlert({ to: legacyTo, firmName: legacyResolved.firmName, qualificationTag: legacyTag, intake: legacyFull, urgentSelfReported: legacyFull.urgent === "yes", submittedAt: legacyNow, leadAdminUrl: legacyLeadAdminUrl });
          legacyAlertStatus = r.sent ? "sent" : "failed";
          legacyAlertError = r.error;
        } catch (e) {
          legacyAlertStatus = "failed";
          legacyAlertError = e instanceof Error ? e.message : String(e);
          console.error("[email] sendNewLeadAlert threw for legacy lead", legacyLead.id, e);
        }
      }
      try {
        await prisma.lead.update({ where: { id: legacyLead.id }, data: { alertStatus: legacyAlertStatus, alertError: legacyAlertError ?? null } });
      } catch (e) {
        console.error("[email] failed to persist alertStatus for legacy lead", legacyLead.id, e);
      }
      const msgs = await prisma.intakeMessage.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: "asc" }, select: { role: true, content: true } });
      return NextResponse.json({ sessionId: session.id, messages: msgs, currentStep: "complete", done: true, leadId: legacyLead.id, urgentSelfReported: legacyFull.urgent === "yes", progress: null, progressHints: [] }, { headers: rateLimitHeaders() });
    }

    if (!isFlowStepKey(step)) {
      return NextResponse.json({ error: "Invalid session state" }, { status: 500 });
    }

    const fieldKey = step;

    await prisma.intakeMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: body.text,
        meta: { step: fieldKey, raw: body.text },
      },
    });

    const history = await prisma.intakeMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });

    const tail = history.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

    const { payload: prevPayload, meta: sessionMeta } = splitSessionStoredData(session.data);

    function sortUpdates(updates: ParsedFieldUpdate[]): ParsedFieldUpdate[] {
      return [...updates].sort(
        (a, b) => FLOW_SEQUENCE.indexOf(a.key) - FLOW_SEQUENCE.indexOf(b.key),
      );
    }

    const clarifyRounds = sessionMeta.clarifyRoundsByField[fieldKey] ?? 0;
    let turn: LlmTurnResult;

    if (clarifyRounds >= MAX_CLARIFY_ROUNDS_BEFORE_FORCE && fieldSupportsForceAccept(fieldKey)) {
      const fv = buildForceAcceptedValue(fieldKey, body.text || "see notes");
      const value = isForceAcceptValueValid(fieldKey, fv) ? fv : buildForceAcceptedValue(fieldKey, "see notes");
      turn = {
        kind: "answer",
        updates: [{ key: fieldKey, value, confidence: 1 }],
        reply: "",
      };
      if (!sessionMeta.forceAcceptedFields.includes(fieldKey)) {
        sessionMeta.forceAcceptedFields.push(fieldKey);
      }
      sessionMeta.qualityRequiresReview = true;
    } else {
      turn = await interpretIntakeTurn({
        fieldKey,
        userText: body.text,
        conversationTail: tail,
        partialPayload: prevPayload,
      });
    }

    if (turn.kind === "legal_refusal" || turn.kind === "off_topic") {
      await prisma.intakeMessage.create({
        data: { sessionId: session.id, role: "assistant", content: turn.reply },
      });
      const messages = await prisma.intakeMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      });
      const progress = intakeProgressLabel(prevPayload);
      const progressHints = intakeProgressHints(prevPayload);
      await prisma.intakeSession.update({
        where: { id: session.id },
        data: { data: mergeSessionStoredData(prevPayload, sessionMeta) as object },
      });
      return NextResponse.json(
        {
          sessionId: session.id,
          messages,
          currentStep: fieldKey,
          done: false,
          progress,
          progressHints,
        },
        { headers: rateLimitHeaders() },
      );
    }

    if (turn.kind === "clarify") {
      const clarifyTarget = turn.targetField ?? fieldKey;
      sessionMeta.clarifyRoundsByField[clarifyTarget] =
        (sessionMeta.clarifyRoundsByField[clarifyTarget] ?? 0) + 1;
      const r = sessionMeta.clarifyRoundsByField[clarifyTarget]!;
      const promptText = assistantPromptForField(clarifyTarget, {
        variantIndex: Math.max(0, r - 1),
        avoidDuplicateOf: sessionMeta.lastPromptByField[clarifyTarget],
      });
      const outgoing = turn.reply.trim() ? turn.reply : promptText;
      sessionMeta.lastPromptByField[clarifyTarget] = outgoing;
      await prisma.intakeMessage.create({
        data: { sessionId: session.id, role: "assistant", content: outgoing },
      });
      await prisma.intakeSession.update({
        where: { id: session.id },
        data: { data: mergeSessionStoredData(prevPayload, sessionMeta) as object },
      });
      const messages = await prisma.intakeMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      });
      const progress = intakeProgressLabel(prevPayload);
      const progressHints = intakeProgressHints(prevPayload);
      return NextResponse.json(
        {
          sessionId: session.id,
          messages,
          currentStep: fieldKey,
          done: false,
          progress,
          progressHints,
        },
        { headers: rateLimitHeaders() },
      );
    }

    let nextData: Partial<IntakePayload> = { ...prevPayload };
    const sorted = sortUpdates(turn.updates);
    const userSnippet = body.text.trim().slice(0, 500);
    for (const u of sorted) {
      nextData = { ...nextData, [u.key]: u.value as never };
      nextData = applyIntakeDefaults(nextData);
      if (u.key === "incidentType") {
        nextData.incidentTypeUserText = userSnippet;
      }
      delete sessionMeta.clarifyRoundsByField[u.key];
      sessionMeta.lastPromptByField[u.key] = undefined;
    }

    let nextStep: FlowStep = "complete";
    const missing = firstMissingField(nextData);
    if (missing) {
      nextStep = missing;
    }

    if (missing) {
      const followUp = assistantPromptForField(missing, { variantIndex: 0 });
      sessionMeta.lastPromptByField[missing] = followUp;
      await prisma.intakeMessage.create({
        data: { sessionId: session.id, role: "assistant", content: followUp },
      });
    }

    let leadId: string | undefined;
    let submission: { urgentSelfReported: boolean } | undefined;

    if (nextStep === "complete") {
      // Pure computation first — if any of this throws the session has not been sealed yet.
      const full = intakePayloadSchema.parse(nextData);
      submission = { urgentSelfReported: full.urgent === "yes" };
      const intakeQuality =
        sessionMeta.forceAcceptedFields.length > 0
          ? {
              forceAcceptedFields: [...sessionMeta.forceAcceptedFields],
              notes: sessionMeta.qualityRequiresReview
                ? ["One or more answers were accepted after repeated clarification — please verify."]
                : undefined,
            }
          : undefined;
      const tag = qualifyIntake(full, {
        qualityRequiresReview: sessionMeta.qualityRequiresReview,
      });
      const now = new Date();
      const summaryJson = buildSummaryJson(full, tag, now, intakeQuality);
      const humanSummary = buildHumanSummary(full, tag, now, intakeQuality);
      const resolved = resolveFirmDisplay(session.firm);
      const closing = closingMessageForFirm(session.firm, {
        urgentYes: full.urgent === "yes",
      });

      // Atomic: session seal + lead row + closing message commit together or not at all.
      // This prevents a zombie sealed session with no Lead if any write fails.
      const [, lead] = await prisma.$transaction([
        prisma.intakeSession.update({
          where: { id: session.id },
          data: {
            data: mergeSessionStoredData(nextData, sessionMeta) as object,
            currentStep: "complete",
            completedAt: now,
          },
        }),
        prisma.lead.create({
          data: {
            firmId: session.firmId,
            intakeSessionId: session.id,
            qualificationTag: tag,
            summaryJson: summaryJson as Prisma.InputJsonValue,
            humanSummary,
            contactName: full.fullName,
            contactEmail: full.email,
            contactPhone: full.phone,
          },
        }),
        prisma.intakeMessage.create({
          data: { sessionId: session.id, role: "assistant", content: closing },
        }),
      ]);
      leadId = lead.id;

      const to =
        resolveLeadAlertEmail(session.firm)?.trim() ||
        process.env.LEAD_ALERT_EMAIL?.trim() ||
        null;

      let alertStatus = "no_recipient";
      let alertError: string | undefined;

      if (to) {
        try {
          const proto = req.headers.get("x-forwarded-proto") ?? "https";
          const host = req.headers.get("host") ?? "";
          const leadAdminUrl = host ? `${proto}://${host}/admin/leads/${lead.id}` : null;
          const emailResult = await sendNewLeadAlert({
            to,
            firmName: resolved.firmName,
            qualificationTag: tag,
            intake: full,
            urgentSelfReported: full.urgent === "yes",
            submittedAt: now,
            leadAdminUrl,
          });
          alertStatus = emailResult.sent ? "sent" : "failed";
          alertError = emailResult.error;
        } catch (e) {
          alertStatus = "failed";
          alertError = e instanceof Error ? e.message : String(e);
          console.error("[email] sendNewLeadAlert threw unexpectedly for lead", lead.id, e);
        }
      }

      try {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { alertStatus, alertError: alertError ?? null },
        });
      } catch (e) {
        console.error("[email] failed to persist alertStatus for lead", lead.id, e);
      }
    } else {
      await prisma.intakeSession.update({
        where: { id: session.id },
        data: {
          data: mergeSessionStoredData(nextData, sessionMeta) as object,
          currentStep: nextStep,
          completedAt: null,
        },
      });
    }

    const messages = await prisma.intakeMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });

    const progress = nextStep === "complete" ? null : intakeProgressLabel(nextData);
    const progressHints = nextStep === "complete" ? [] : intakeProgressHints(nextData);

    return NextResponse.json(
      {
        sessionId: session.id,
        messages,
        currentStep: nextStep,
        done: nextStep === "complete",
        leadId,
        progress,
        progressHints,
        submission,
      },
      { headers: rateLimitHeaders() },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Something went wrong saving your submission. Please type your last answer again to try once more." }, { status: 500 });
  }
}
