"use client";

import { useState } from "react";

import { ActionButton } from "./action-feedback";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Sign out and Delete account, kept apart at the top right: a neutral button and a red one with a divider
 * between, and deleting always asks first.
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
      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={signOut}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Sign out
        </button>
        <span className="h-5 border-l border-slate-300 dark:border-slate-600" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          Delete account
        </button>
      </div>
      {confirming && (
        <div role="alertdialog" aria-label="Delete your account" className="mt-3 w-full rounded-lg border border-red-200 bg-red-50/50 p-3 text-sm dark:border-red-900 dark:bg-red-950/30">
          <p className="text-slate-800 dark:text-slate-200">
            This deletes your account and every report not yet published, with its photos. Published reports stay on the public
            record with nothing linking them to you.
          </p>
          <label className="mt-2 flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={removeAll} onChange={(e) => setRemoveAll(e.target.checked)} />
            Remove my published reports too
          </label>
          <div className="mt-3 flex gap-2">
            <ActionButton
              label="Yes, delete my account"
              busyLabel="Deleting…"
              busy={busy}
              onClick={remove}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white"
            />
            <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-600">
              Cancel
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-700 dark:text-red-400">{error}</p>}
        </div>
      )}
    </>
  );
}
