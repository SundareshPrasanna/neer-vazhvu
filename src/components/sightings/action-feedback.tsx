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
  icon,
  pressed,
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  className: string;
  icon?: React.ReactNode;
  /** For a button that opens a panel: shows it as pressed while the panel is open. */
  pressed?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled} aria-busy={busy} aria-pressed={pressed} className={className}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {busy ? busyLabel : label}
    </button>
  );
}

/** A value that clears itself after a few seconds: an in-place "Saved" next to what changed. */
export function useFlash<T>(ms = 4000): [T | null, (value: T) => void] {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    if (value == null) return;
    const t = setTimeout(() => setValue(null), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return [value, useCallback((v: T) => setValue(v), [])];
}
