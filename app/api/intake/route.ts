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
import { clientIp, checkRateLimit } from "@/lib/rate-limit";
import { intakePayloadSchema, type IntakePayload } from "@/lib/schemas/intake-data";
import { getFirmConfigForSlug } from "@/config/firm";
import type { Firm } from "@/app/generated/prisma/client";
import { resolveFirmDisplay, resolveLeadAlertEmail } from "@/lib/firm-display";
import { buildHumanSummary, buildIntakeBriefParagraph, buildSummaryJson } from "@/lib/summary";
import { sendNewLeadAlert } from "@/lib/email";

function openingMessagesForFirm(firm: Firm) {
  const cfg = getFirmConfigForSlug(firm.slug);
  const r = resolveFirmDisplay(firm);

  if (cfg) {
    const greeting = [
      `Thank you for contacting ${cfg.firmName}.`,
      "",
      cfg.greetingMessage.trim(),
      "",
      "I'm an automated intake assistant — not a lawyer. I can't provide legal advice.",
      "This conversation does not create an attorney–client relationship. Only a licensed attorney can evaluate your matter.",
      "If you are having a medical or safety emergency, call 911 (or your local emergency number) right away.",
    ].join("\n");
    return { greeting, disclaimer: cfg.disclaimerText.trim() };
  }

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
  const cfg = getFirmConfigForSlug(firm.slug);
  const r = resolveFirmDisplay(firm);
  const firmName = (cfg?.firmName ?? r.firmName).trim() || r.firmName;
  const urgentPhoneDisplay = cfg?.urgentPhoneDisplay ?? r.urgentPhoneDisplay;

  const lines = [
    "Thank you — your information has been received.",
    "",
    `A member of ${firmName} will review your case and contact you shortly.`,
  ];
  if (opts.urgentYes) {
    lines.push(
      "",
      `Because you indicated this may be urgent, we recommend calling the office directly: ${urgentPhoneDisplay}.`,
    );
  } else {
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
]);

const WINDOW_MS = 60_000;
const MAX_REQ = Number(process.env.INTAKE_RATE_LIMIT_PER_MIN ?? 30);

function rateLimitHeaders(retryAfter?: number): HeadersInit {
  const h: Record<string, string> = {
    "X-RateLimit-Limit": String(MAX_REQ),
    "X-RateLimit-Window": String(WINDOW_MS / 1000),
  };
  if (retryAfter != null) h["Retry-After"] = String(retryAfter);
  return h;
}

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const rl = checkRateLimit(`intake:${ip}`, MAX_REQ, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(rl.retryAfterSec) },
    );
  }

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

  try {
    if (body.action === "start") {
      const firm = await prisma.firm.findUnique({ where: { slug: body.firmSlug } });
      if (!firm) {
        return NextResponse.json({ error: "Firm not found" }, { status: 404 });
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

    // message
    const session = await prisma.intakeSession.findUnique({
      where: { id: body.sessionId },
      include: { firm: true },
    });
    if (!session || session.completedAt) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
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

    await prisma.intakeSession.update({
      where: { id: session.id },
      data: {
        data: mergeSessionStoredData(nextData, sessionMeta) as object,
        currentStep: nextStep,
        completedAt: nextStep === "complete" ? new Date() : null,
      },
    });

    let leadId: string | undefined;
    let submission: { urgentSelfReported: boolean } | undefined;

    if (nextStep === "complete") {
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
      const briefParagraph = buildIntakeBriefParagraph(full, tag);
      const resolved = resolveFirmDisplay(session.firm);

      const lead = await prisma.lead.create({
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
      });
      leadId = lead.id;

      const to =
        resolveLeadAlertEmail(session.firm)?.trim() ||
        process.env.LEAD_ALERT_EMAIL?.trim() ||
        null;

      if (to) {
        await sendNewLeadAlert({
          to,
          firmName: resolved.firmName,
          contactName: full.fullName,
          qualificationTag: tag,
          briefParagraph,
          humanSummary,
        });
      }

      const closing = closingMessageForFirm(session.firm, {
        urgentYes: full.urgent === "yes",
      });

      await prisma.intakeMessage.create({
        data: { sessionId: session.id, role: "assistant", content: closing },
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
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
