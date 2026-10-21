"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { ActionButton } from "./action-feedback";
import { flushOutbox, removeQueued, useOutbox } from "./draft-store";
import { day } from "./report-card";
import { btn, muted, rule } from "./ui";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

/** Reports saved on this phone while offline, each with Send now and Remove; nothing when none wait. */
export function OutboxBlock({ owner, authFetch, onChange }: { owner: string | null; authFetch: Fetch; onChange: () => void }) {
  const { items, sent } = useOutbox(owner);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!owner) return null;
  if (!items.length) {
    return sent > 0 ? (
      <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
        <Check className="h-4 w-4" aria-hidden="true" />
        {sent === 1 ? "Your saved report was sent. It is in your list now." : `Your ${sent} saved reports were sent. They are in your list now.`}
      </p>
    ) : null;
  }

  const sendNow = async (id: string) => {
    setBusy(id);
    setError(null);
    const r = await flushOutbox(owner, authFetch, id);
    setBusy(null);
    if (r.sent) onChange();
    else if (r.offline) setError("Still no connection. It will send by itself when you are back online.");
  };
  const remove = async (id: string) => {
    setBusy(id);
    setError(null);
    const ok = await removeQueued(id);
    setBusy(null);
    setRemoving(null);
    if (!ok) setError("Could not remove it. Please try again.");
  };

  return (
    <section aria-labelledby="outbox-title" className="space-y-3 rounded-xl bg-slate-50 p-4 sm:p-5 dark:bg-slate-900">
      <div>
        <h2 id="outbox-title" className="font-semibold text-slate-900 dark:text-slate-100">
          {plural(items.length, "1 report waiting to send", "reports waiting to send")}
        </h2>
        <p className={`mt-0.5 text-sm ${muted}`}>
          Saved on this phone. {items.length === 1 ? "It sends" : "They send"} by {items.length === 1 ? "itself" : "themselves"} when you are back online.
        </p>
      </div>
      <ul className={`divide-y border-t ${rule}`}>
        {items.map((q) => (
          <li key={q.id} className="space-y-2 py-3">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{q.label}</p>
              <p className={`text-sm ${muted}`}>{[q.place, `saved ${day(new Date(q.savedAt).toISOString())}`].filter(Boolean).join(", ")}</p>
            </div>
            {q.error && (
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                {q.error}
                {q.status === 409 && " It may have reached us already: check your list below before sending it again."}
              </p>
            )}
            {removing === q.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-800 dark:text-slate-200">Remove it from this phone? It will not be sent.</span>
                <ActionButton label="Remove" busyLabel="Removing…" busy={busy === q.id} onClick={() => void remove(q.id)} className={btn("dangerQuiet", "sm")} />
                <button type="button" onClick={() => setRemoving(null)} className={btn("quiet", "sm")}>
                  Keep it
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <ActionButton label="Send now" busyLabel="Sending…" busy={busy === q.id} disabled={busy != null} onClick={() => void sendNow(q.id)} className={btn("secondary", "sm")} />
                <button type="button" disabled={busy != null} onClick={() => setRemoving(q.id)} className={btn("quiet", "sm")}>
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
