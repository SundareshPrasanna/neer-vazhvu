"use client";

import { useState, useRef, useId, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

export function InfoTooltip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const tooltipW = 256; // w-64 = 16rem = 256px
    const tooltipH = tooltipRef.current?.offsetHeight ?? 120;
    const pad = 8;

    // Horizontal: align left edge to button, clamp to viewport
    let left = rect.left;
    if (left + tooltipW > window.innerWidth - pad) left = window.innerWidth - pad - tooltipW;
    if (left < pad) left = pad;

    // Vertical: prefer below, flip above if no room
    let top = rect.bottom + 4;
    if (top + tooltipH > window.innerHeight - pad) {
      top = rect.top - tooltipH - 4;
    }

    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updatePosition();

    function closeOnOutside(e: PointerEvent) {
      if (
        btnRef.current?.contains(e.target as Node) ||
        tooltipRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    function closeOnEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScrollOrResize() { setOpen(false); }

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  return (
    <span className="inline-flex print:hidden">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 text-[9px] font-bold leading-none"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
      >
        i
      </button>
      {open && createPortal(
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="fixed z-50 w-64 rounded-lg border border-slate-200 bg-white p-2.5 text-xs leading-relaxed text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden" }}
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}
