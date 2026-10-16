"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/** A button that shows it is working: a spinner and a busy label, disabled meanwhile. */
export function ActionButton({
  label,
  busyLabel,
  busy,
  disabled,
  onClick,
  className,
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  className: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled} aria-busy={busy} className={`${className} inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60`}>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {busy ? busyLabel : label}
    </button>
  );
}

export type Notice = { text: string; ok: boolean } | null;

/** A short confirmation that fades after a few seconds; announced to screen readers. */
export function useNotice(): [Notice, (text: string, ok?: boolean) => void] {
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  const show = useCallback((text: string, ok = true) => setNotice({ text, ok }), []);
  return [notice, show];
}

export function NoticeBar({ notice }: { notice: Notice }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[3000] flex justify-center px-4">
      {notice && (
        <p
          className={`pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
            notice.ok ? "bg-emerald-700 text-white" : "bg-red-700 text-white"
          }`}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}
