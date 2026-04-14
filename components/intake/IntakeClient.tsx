"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Msg = { role: string; content: string };

type Props = {
  firmSlug: string;
  firmDisplayName: string;
  primaryColor: string;
  disclaimerText: string;
  logoUrl: string;
  urgentPhoneDisplay: string;
  urgentPhoneTel: string;
  /** Full-page intake vs iframe widget (affects height + scroll). */
  variant?: "page" | "embed";
};

export function IntakeClient({
  firmSlug,
  firmDisplayName,
  primaryColor,
  disclaimerText,
  logoUrl,
  urgentPhoneDisplay,
  urgentPhoneTel,
  variant = "page",
}: Props) {
  const isEmbed = variant === "embed";
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [urgentSelfReported, setUrgentSelfReported] = useState(false);
  const [progress, setProgress] = useState<{ step: number; total: number } | null>(null);
  const [progressHints, setProgressHints] = useState<string[]>([]);
  const [showNotice, setShowNotice] = useState(false);
  /** Bump to re-run start (e.g. after a failed request). */
  const [sessionStartKey, setSessionStartKey] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    let cancelled = false;
    setSessionId(null);
    setMessages([]);
    setDisclaimerAcknowledged(false);
    setDone(false);
    setLeadId(null);
    setProgress(null);
    setProgressHints([]);
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch("/api/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start", firmSlug }),
        });
        const raw = await res.text();
        let j: {
          sessionId?: string;
          messages?: Msg[];
          progress?: { step: number; total: number } | null;
          progressHints?: string[];
          error?: string;
        };
        try {
          j = JSON.parse(raw) as typeof j;
        } catch {
          throw new Error(
            res.ok
              ? "Unexpected response from server."
              : `Server error (${res.status}). Try again in a moment.`,
          );
        }
        if (!res.ok) throw new Error(j.error ?? "Could not start session");
        if (cancelled) return;
        setSessionId(j.sessionId ?? null);
        setMessages(j.messages ?? []);
        if (j.progress) setProgress(j.progress);
        setProgressHints(Array.isArray(j.progressHints) ? j.progressHints : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [firmSlug, sessionStartKey]);

  function retryStart() {
    setSessionStartKey((k) => k + 1);
  }

  async function acknowledge() {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge_disclaimer", sessionId }),
      });
      const j = (await res.json()) as {
        messages?: Msg[];
        progress?: { step: number; total: number } | null;
        progressHints?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "Could not continue");
      setMessages(j.messages ?? []);
      if (j.progress) setProgress(j.progress);
      setProgressHints(Array.isArray(j.progressHints) ? j.progressHints : []);
      setDisclaimerAcknowledged(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !input.trim() || loading || done || !disclaimerAcknowledged) return;
    const text = input.trim();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", sessionId, text }),
      });
      const j = (await res.json()) as {
        messages?: Msg[];
        done?: boolean;
        leadId?: string;
        progress?: { step: number; total: number } | null;
        progressHints?: string[];
        submission?: { urgentSelfReported: boolean };
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "Could not send");
      setInput("");
      setMessages(j.messages ?? []);
      if (j.progress) setProgress(j.progress);
      setProgressHints(Array.isArray(j.progressHints) ? j.progressHints : []);
      if (j.done) {
        setDone(true);
        setLeadId(j.leadId ?? null);
        setUrgentSelfReported(j.submission?.urgentSelfReported ?? false);
        setProgress(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-[#e0ddd4] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${
        isEmbed ? "h-full min-h-0" : "min-h-[72vh]"
      }`}
    >
      <header
        className="flex items-start justify-between gap-4 border-b border-[#ebe8e0] px-5 py-4 sm:items-center"
        style={{ borderTop: `3px solid ${primaryColor}` }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {logoUrl ? (
            // Remote firm logos: avoid next/image remotePatterns config for demo flexibility
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-10 w-auto max-w-[120px] shrink-0 object-contain object-left"
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
              Intake assistant
              {progress && disclaimerAcknowledged && !done ? (
                <span className="ml-2 font-normal normal-case tracking-normal text-[#94a3b8]">
                  · Step {progress.step} of {progress.total}
                </span>
              ) : null}
            </p>
            <h1 className="font-serif text-lg font-semibold leading-snug tracking-tight text-[#0f172a]">
              {firmDisplayName}
            </h1>
            {progressHints.length > 0 && disclaimerAcknowledged && !done ? (
              <ul className="mt-2 list-inside list-disc text-[11px] leading-snug text-[#94a3b8]">
                {progressHints.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowNotice((s) => !s)}
          className="shrink-0 text-xs font-medium text-[#475569] underline decoration-[#cbd5e1] underline-offset-2 hover:text-[#0f172a]"
        >
          {showNotice ? "Hide legal notice" : "Legal notice"}
        </button>
      </header>

      {showNotice ? (
        <div className="border-b border-amber-100/90 bg-amber-50/90 px-5 py-3.5 text-sm text-amber-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/90">Important</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-relaxed">{disclaimerText}</pre>
        </div>
      ) : null}

      {error && !disclaimerAcknowledged ? (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-900">
          <p className="font-medium">Intake couldn’t start</p>
          <p className="mt-1 text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => retryStart()}
            className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={`min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 ${
            isEmbed ? "min-h-[120px]" : "min-h-[200px]"
          }`}
        >
          {loading && messages.length === 0 ? (
            <p className="text-sm text-[#64748b]">Starting secure session…</p>
          ) : null}
          {!loading && !sessionId && messages.length === 0 && !error ? (
            <p className="text-sm text-[#64748b]">
              No session loaded.{" "}
              <button type="button" className="font-medium text-[#0f172a] underline" onClick={() => retryStart()}>
                Retry
              </button>
            </p>
          ) : null}
          {messages.map((m, i) => (
            <div
              key={`${i}-${m.content.slice(0, 24)}`}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed sm:text-sm ${
                  m.role === "user"
                    ? "text-white shadow-sm"
                    : "bg-[#f8f9fa] text-[#0f172a] ring-1 ring-[#e8eaed]"
                }`}
                style={
                  m.role === "user"
                    ? {
                        backgroundColor: primaryColor,
                        boxShadow: `0 0 0 1px ${primaryColor}`,
                      }
                    : undefined
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && messages.length > 0 ? (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-[#f8f9fa] px-4 py-3 ring-1 ring-[#e8eaed]">
                <span className="inline-flex items-center gap-1" aria-label="Thinking">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#94a3b8]" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#94a3b8]" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#94a3b8]" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-[#ebe8e0] bg-[#faf9f6] px-4 py-2 text-center text-[10px] leading-snug text-[#64748b] sm:text-[11px]">
          Not a lawyer · Does not provide legal advice · No attorney–client relationship ·{" "}
          <button
            type="button"
            className="font-medium text-[#475569] underline underline-offset-2 hover:text-[#0f172a]"
            onClick={() => setShowNotice(true)}
          >
            Full notice
          </button>
        </div>

        {!disclaimerAcknowledged && sessionId && !loading ? (
          <div className="border-t border-[#ebe8e0] bg-white px-5 py-4">
            <p className="text-sm leading-relaxed text-[#475569]">
              Please review the legal notice (link above), then continue to the questions.
            </p>
            <button
              type="button"
              onClick={() => void acknowledge()}
              disabled={loading}
              className="mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-95 disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              I understand — continue
            </button>
          </div>
        ) : null}

        {disclaimerAcknowledged && !done ? (
          <form onSubmit={sendMessage} className="border-t border-[#ebe8e0] bg-white p-4">
            {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your answer…"
                disabled={loading}
                className="flex-1 rounded-lg border border-[#d1d5db] bg-[#fafafa] px-3 py-2.5 text-sm outline-none transition focus:border-[#94a3b8] focus:bg-white focus:ring-2 focus:ring-[#0f172a]/10"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                Send
              </button>
            </div>
          </form>
        ) : null}

        {done ? (
          <div className="border-t border-[#dbeafe] bg-[#f0f7ff] px-5 py-5 text-sm text-[#0f172a]">
            <p className="font-semibold text-[#0f172a]">Thank you — your information was received.</p>
            <p className="mt-2 leading-relaxed text-[#334155]">
              A member of <span className="font-medium text-[#0f172a]">{firmDisplayName}</span> will review
              your submission and reach out shortly.
            </p>
            {urgentSelfReported ? (
              <p className="mt-4 text-[#334155]">
                <span className="font-medium text-[#0f172a]">
                  Because you indicated this may be urgent, please contact the office directly.
                </span>
                {urgentPhoneDisplay ? (
                  <>
                    {" "}
                    <a
                      href={`tel:${urgentPhoneTel}`}
                      className="font-semibold underline decoration-2 underline-offset-2"
                      style={{ color: primaryColor }}
                    >
                      {urgentPhoneDisplay}
                    </a>
                  </>
                ) : null}
              </p>
            ) : urgentPhoneDisplay ? (
              <p className="mt-4 text-[#334155]">
                <span className="font-medium text-[#0f172a]">Need to reach us sooner?</span>{" "}
                <a
                  href={`tel:${urgentPhoneTel}`}
                  className="font-semibold underline decoration-2 underline-offset-2"
                  style={{ color: primaryColor }}
                >
                  {urgentPhoneDisplay}
                </a>
              </p>
            ) : null}
            <p className="mt-3 text-xs text-[#64748b]">
              Reference: <span className="font-mono text-[11px] text-[#475569]">{leadId}</span>
            </p>
            <p className="mt-3 text-xs leading-relaxed text-[#64748b]">
              This tool is not a lawyer and cannot give legal advice. Emergencies: call 911.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
