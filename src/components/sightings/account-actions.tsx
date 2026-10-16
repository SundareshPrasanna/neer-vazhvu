"use client";

import { useState } from "react";
import { LogOut, Trash2 } from "lucide-react";

import { ActionButton } from "./action-feedback";
import { btn } from "./ui";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Sign out and Delete account, always at the top right and kept apart: a neutral button, a divider, then a red one;
 * deleting always asks first. On phones they take the first row, above the view switch.
 */
export function AccountActions({ authFetch, signOut }: { authFetch: Fetch; signOut: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [removeAll, setRemoveAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    const res = await authFetch(`/api/sightings/mine${removeAll ? "?published=remove" : ""}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("Could not delete. Please try again.");
    signOut();
  };

  return (
    <>
      <div className="order-first -mr-3 flex w-full items-center justify-end sm:order-last sm:ml-auto sm:w-auto">
        <button type="button" onClick={signOut} className={btn("quiet", "sm")}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
        <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
        <button type="button" onClick={() => setConfirming(true)} aria-expanded={confirming} className={btn("dangerQuiet", "sm")}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete account
        </button>
      </div>
      {confirming && (
        <div
          role="alertdialog"
          aria-labelledby="delete-account-title"
          aria-describedby="delete-account-text"
          className="order-last w-full rounded-xl border border-red-200 bg-red-50/70 p-4 transition duration-300 ease-out starting:opacity-0 sm:p-5 dark:border-red-900/60 dark:bg-red-950/30"
        >
          <p id="delete-account-title" className="font-semibold text-slate-900 dark:text-slate-100">
            Delete your account?
          </p>
          <p id="delete-account-text" className="mt-1 max-w-[62ch] text-sm text-slate-700 dark:text-slate-300">
            This deletes your account and every report not yet published, with its photos. Published reports stay on the public record
            with nothing linking them to you.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
            <input type="checkbox" checked={removeAll} onChange={(e) => setRemoveAll(e.target.checked)} className="h-4 w-4 accent-red-700" />
            Remove my published reports too
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton label="Delete my account" busyLabel="Deleting…" busy={busy} onClick={remove} className={btn("danger", "md")} />
            <button type="button" onClick={() => setConfirming(false)} className={btn("secondary", "md")}>
              Keep my account
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  );
}
