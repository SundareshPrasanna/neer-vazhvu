"use client";

import { useEffect, useState } from "react";

import { ReportCard, day } from "./report-card";
import { useCitizen } from "./use-citizen";
import { OTHER_KEY, REPORT_GROUPS } from "@/lib/sightings/taxonomy";
import type { OwnReport } from "@/lib/sightings/types";

interface QueueItem extends OwnReport {
  note: string | null;
  candidateLabel: string | null;
  exif: { capturedAt: string | null; lat: number | null; lng: number | null };
  photos: { kind: "report" | "fixed"; published: boolean; url: string | null }[];
  reporter: { key: string; trusted: boolean; suspended: boolean; total: number; rejected: number };
}

const small = "rounded-md border px-3 py-1.5 text-xs font-medium";
/** Flags for the reviewer; nothing is rejected automatically. */
const OLD_PHOTO_DAYS = 30;
const FAR_KM = 1;

function Item({ item, act }: { item: QueueItem; act: (body: object) => Promise<void> }) {
  const [type, setType] = useState(item.subcategory ? `${item.category}:${item.subcategory}` : item.category);
  const [candidate, setCandidate] = useState(item.candidateLabel ?? "");
  const [reason, setReason] = useState("");
  const pendingFixed = item.photos.some((p) => p.kind === "fixed" && !p.published);
  const [category, subcategory] = type.split(":");
  const exifGap =
    item.exif.lat != null && item.lat != null ? Math.hypot((item.exif.lat - item.lat) * 111, (item.exif.lng! - item.lng!) * 111 * Math.cos((item.lat * Math.PI) / 180)) : null;

  const ageDays = item.exif.capturedAt ? (new Date(item.createdAt).getTime() - new Date(item.exif.capturedAt).getTime()) / 86_400_000 : null;
  const flags = [
    ageDays != null && ageDays > OLD_PHOTO_DAYS && { text: `Old photo (${Math.round(ageDays)} days)`, tone: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" },
    exifGap != null && exifGap > FAR_KM && { text: `Far from pin (${exifGap.toFixed(1)} km)`, tone: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
    !item.exif.capturedAt && item.exif.lat == null && { text: "No photo data", tone: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200" },
  ].filter((f): f is { text: string; tone: string } => !!f);

  return (
    <ReportCard report={item}>
      {flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {flags.map((f) => (
            <span key={f.text} className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.tone}`}>
              {f.text}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {item.photos.map((p, i) =>
          p.url ? (
            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.kind} className="h-40 rounded object-cover" />
              <span className="text-xs text-slate-500">{p.kind}{p.published ? ", published" : ""}</span>
            </a>
          ) : null,
        )}
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-xs text-slate-600 dark:text-slate-400">
        <dt>Note</dt>
        <dd>{item.note ?? "none"}</dd>
        <dt>Photo taken</dt>
        <dd>{item.exif.capturedAt ? day(item.exif.capturedAt) : "no date in photo"}</dd>
        <dt>Photo GPS</dt>
        <dd>{exifGap != null ? `${exifGap.toFixed(1)} km from the pin` : "none"}</dd>
        <dt>Reporter</dt>
        <dd>
          #{item.reporter.key.slice(0, 8)}: {item.reporter.total} reports, {item.reporter.rejected} rejected{item.reporter.trusted ? ", trusted" : ", new"}
          {item.reporter.suspended && ", SUSPENDED"}
        </dd>
      </dl>

      {item.reviewStatus === "received" && (
        <div className="mt-3 space-y-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white p-1.5 text-sm dark:border-slate-600 dark:bg-slate-900">
            {REPORT_GROUPS.map((g) => (
              <optgroup key={g.key} label={g.label}>
                {g.types.map((t) => (
                  <option key={t.key} value={`${g.key}:${t.key}`}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={OTHER_KEY}>Other</option>
          </select>
          {category === OTHER_KEY && (
            <input
              value={candidate}
              onChange={(e) => setCandidate(e.target.value)}
              placeholder="Candidate new type (optional)"
              className="w-full rounded-md border border-slate-300 bg-white p-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          )}
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason, shown to the reporter if rejected"
            className="w-full rounded-md border border-slate-300 bg-white p-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${small} border-emerald-700 bg-emerald-700 text-white`} onClick={() => act({ action: "approve", id: item.id, category, subcategory: subcategory ?? null, candidateLabel: candidate })}>
              Approve
            </button>
            <button type="button" className={`${small} border-slate-400`} onClick={() => act({ action: "reject", id: item.id, reason })}>
              Reject
            </button>
            <button
              type="button"
              className={`${small} border-red-700 text-red-700`}
              onClick={() => confirm("Suspend this account and reject everything it has waiting?") && act({ action: "suspend", reporterKey: item.reporter.key, reason })}
            >
              Suspend account
            </button>
          </div>
        </div>
      )}
      {pendingFixed && (
        <div className="mt-3 flex gap-2">
          <button type="button" className={`${small} border-emerald-700 bg-emerald-700 text-white`} onClick={() => act({ action: "publish_fixed", id: item.id })}>
            Publish fixed photo
          </button>
          <button type="button" className={`${small} border-slate-400`} onClick={() => act({ action: "discard_fixed", id: item.id })}>
            Discard fixed photo
          </button>
        </div>
      )}
    </ReportCard>
  );
}

/** Reviewer queue: oldest first. The API checks the reviewer allowlist. */
export function ReviewApp() {
  const { session, ready, signIn, authFetch } = useCitizen();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!session) return;
    let live = true;
    authFetch("/api/sightings/review")
      .then(async (res) => {
        if (!live) return;
        if (!res.ok) return setError(res.status === 403 ? "This account is not a reviewer." : "Could not load the queue.");
        setItems((await res.json()).data);
      })
      .catch(() => live && setError("Could not load the queue."));
    return () => {
      live = false;
    };
  }, [session, authFetch, tick]);

  const act = async (body: object) => {
    const res = await authFetch("/api/sightings/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Action failed.");
    setTick((t) => t + 1);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Citizen reports: review</h1>
      {!ready ? null : !session ? (
        <button type="button" onClick={signIn} className="mt-4 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white">
          Sign in
        </button>
      ) : (
        <>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{items ? `${items.length} waiting` : "Loading"}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Reject a photo that shows a face, a vehicle number plate, or a house name or number, and any note or reading that names a
            person. For a water test, check the values against the meter or kit in the photo.
          </p>
          <div className="mt-4 space-y-4">
            {items?.map((item) => (
              <Item key={item.id} item={item} act={act} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
