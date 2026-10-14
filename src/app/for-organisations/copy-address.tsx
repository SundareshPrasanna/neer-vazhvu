"use client";

import { useState } from "react";

/** Icon button that copies the contact address, for readers on webmail where mailto opens nothing.
 *  Falls back to selecting the address where the clipboard is refused. */
export function CopyAddress({ address, className, targetId }: { address: string; className: string; targetId: string }) {
  const [state, setState] = useState<"idle" | "done" | "selected">("idle");

  const select = () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    setState("selected");
  };

  const copy = () => {
    if (!navigator.clipboard?.writeText) return select();
    navigator.clipboard.writeText(address).then(() => {
      setState("done");
      setTimeout(() => setState("idle"), 2400);
    }, select);
  };

  const label = state === "done" ? "Email address copied" : "Copy email address";
  return (
    <>
      <button type="button" className={className} data-state={state === "done" ? "done" : undefined} onClick={copy} aria-label={label} title={label}>
        {state === "done" ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="1.5" />
            <path strokeLinecap="round" d="M15 9V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15H9" />
          </svg>
        )}
      </button>
      <span role="status" aria-live="polite" style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>
        {state === "done" ? "Copied" : state === "selected" ? "Address selected. Press Ctrl+C or Cmd+C to copy." : ""}
      </span>
    </>
  );
}
