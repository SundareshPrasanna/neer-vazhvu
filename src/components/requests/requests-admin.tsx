"use client";

import { useEffect, useState } from "react";

import { signInHere } from "@/components/requests/request-form";
import { useCitizen } from "@/components/sightings/use-citizen";
import { REQUEST_STATUSES, type RequestKind, type RequestStatus } from "@/lib/requests/validate";

interface Row {
  id: string;
  created_at: string;
  requester_name: string | null;
  contact_email: string | null;
  kind: RequestKind;
  subject: string;
  subject_key: string;
  message: string | null;
  source_path: string | null;
  status: RequestStatus;
  reviewed_at: string | null;
  reviewer_note: string | null;
  /** Distinct accounts that asked for the same kind and subject. */
  asks: number;
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const small = "rounded-md border px-2.5 py-1 text-xs font-medium";

function Item({ row, act }: { row: Row; act: (body: object) => Promise<void> }) {
  const [note, setNote] = useState(row.reviewer_note ?? "");
  return (
    <li className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-slate-900 dark:text-slate-100">
          {row.subject} <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{row.kind}</span>
        </p>
        <p className="text-xs text-slate-500">
          {day(row.created_at)} - {row.status}
          {row.asks > 1 && ` - ${row.asks} people asked`}
        </p>
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {row.requester_name ?? "Deleted account"}
        {row.contact_email && (
          <>
            {" - "}
            <a className="text-cyan-700 dark:text-cyan-400" href={`mailto:${row.contact_email}`}>
              {row.contact_email}
            </a>
          </>
        )}
      </p>
      {row.message && <p className="mt-2 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{row.message}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (private)"
          maxLength={280}
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white p-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        {REQUEST_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => act({ id: row.id, status: s, note })}
            className={`${small} ${s === row.status ? "border-cyan-700 bg-cyan-700 text-white" : "border-slate-400"}`}
          >
            {s}
          </button>
        ))}
      </div>
    </li>
  );
}

/** Requests, newest first, with demand per subject. The API checks the reviewer allowlist. */
export function RequestsAdmin() {
  const { session, ready, signIn, authFetch } = useCitizen();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!session) return;
    let live = true;
    authFetch("/api/requests/review")
      .then(async (res) => {
        if (!live) return;
        if (!res.ok) return setError(res.status === 403 ? "This account is not a reviewer." : "Could not load requests.");
        setRows((await res.json()).data);
      })
      .catch(() => live && setError("Could not load requests."));
    return () => {
      live = false;
    };
  }, [session, authFetch, tick]);

  const act = async (body: object) => {
    const res = await authFetch("/api/requests/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Action failed.");
    setTick((t) => t + 1);
  };

  const closed = (r: Row) => r.status === "done" || r.status === "declined";
  const shown = rows?.filter((r) => showClosed || !closed(r)) ?? [];
  // Most-asked first: one line per subject, for deciding what to onboard next.
  const demand = [...new Map(shown.map((r) => [`${r.kind}:${r.subject_key}`, r])).values()].sort((a, b) => b.asks - a.asks).slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Requests</h1>
      {!ready ? null : !session ? (
        <button type="button" onClick={() => signInHere(signIn)} className="mt-4 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white">
          Sign in
        </button>
      ) : (
        <>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          <div className="mt-2 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <p>{rows ? `${shown.length} ${showClosed ? "requests" : "open"}` : "Loading"}</p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
              Show done and declined
            </label>
          </div>
          {demand.length > 0 && (
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
              Most asked: {demand.map((r) => `${r.subject} (${r.asks})`).join(", ")}
            </p>
          )}
          <ul className="mt-4 space-y-3">
            {shown.map((row) => (
              <Item key={`${row.id}:${row.status}`} row={row} act={act} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
