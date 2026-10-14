"use client";

import { useState } from "react";

/** Copies the contact address; falls back to selecting it where the clipboard is refused. */
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

  return (
    <>
      <button type="button" className={className} data-state={state === "done" ? "done" : undefined} onClick={copy} aria-describedby={targetId}>
        {state === "done" ? "Copied" : "Copy address"}
      </button>
      <span role="status" aria-live="polite" style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>
        {state === "selected" ? "Address selected. Press Ctrl+C or Cmd+C to copy." : ""}
      </span>
    </>
  );
}
