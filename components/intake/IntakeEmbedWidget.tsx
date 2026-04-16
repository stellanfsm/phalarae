"use client";

import { useEffect, useRef, useState } from "react";
import { IntakeClient } from "@/components/intake/IntakeClient";

export type IntakeEmbedWidgetProps = {
  firmSlug: string;
  firmDisplayName: string;
  primaryColor: string;
  disclaimerText: string;
  logoUrl: string;
  urgentPhoneDisplay: string;
  urgentPhoneTel: string;
  launcherLabel: string;
};

export function IntakeEmbedWidget(props: IntakeEmbedWidgetProps) {
  const { launcherLabel, ...intakeProps } = props;
  const [open, setOpen] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function handleOpen() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
    setHasOpened(true);
    requestAnimationFrame(() => setPanelVisible(true));
  }

  function handleClose() {
    setPanelVisible(false);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      closeTimer.current = null;
    }, 200);
  }

  return (
    <div className="relative h-full w-full min-h-0 overflow-hidden bg-transparent font-[family-name:var(--font-body)]">
      {!open ? (
        <div className="absolute bottom-0 right-0 z-[1] p-3 sm:p-4">
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex max-w-[calc(100vw-24px)] items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              backgroundColor: intakeProps.primaryColor,
              boxShadow: `0 10px 28px -6px ${intakeProps.primaryColor}55`,
            }}
            aria-expanded={false}
            aria-haspopup="dialog"
          >
            {launcherLabel}
          </button>
        </div>
      ) : null}

      {hasOpened ? (
        <div
          style={{ display: open ? undefined : "none" }}
          className="absolute inset-0 z-[2] flex flex-col justify-end p-2 sm:items-end sm:justify-end sm:p-4"
          role="dialog"
          aria-label={`Chat with ${intakeProps.firmDisplayName}`}
          aria-modal={open ? "true" : undefined}
          aria-hidden={!open || undefined}
        >
          <div
            className={`flex max-h-[min(92dvh,720px)] w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_12px_40px_-8px_rgba(15,23,42,0.25)] transition-[opacity,transform] duration-200 ease-out sm:max-h-[min(580px,85vh)] sm:w-[min(100%,400px)] ${
              panelVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            }`}
          >
            <div className="relative flex min-h-0 flex-1 flex-col">
              <button
                type="button"
                onClick={handleClose}
                className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-lg leading-none text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                aria-label="Close chat"
              >
                ×
              </button>
              <div className="min-h-0 flex-1 px-1 pb-1 pt-1 sm:px-2 sm:pb-2">
                <IntakeClient variant="embed" {...intakeProps} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
