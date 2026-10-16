"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Camera, CloudRain, Construction, Droplets, GlassWater, Loader2, MessageCircle, Sprout, Trash2, Waves, Wrench,
  type LucideIcon,
} from "lucide-react";

import { LIMITS } from "@/lib/sightings/limits";
import { OTHER_KEY, REPORT_GROUPS } from "@/lib/sightings/taxonomy";
import type { Handler } from "@/lib/sightings/types";
import type { Channel } from "@/lib/sightings/routing/types";
import { HandlerCard } from "./handler-card";
import { readPhotoMeta, shrinkPhoto } from "./use-citizen";

const LocationMap = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => <div className="h-56 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />,
});

const ICONS: Record<string, LucideIcon> = { Trash2, Droplets, Waves, GlassWater, Wrench, CloudRain, Construction, Sprout };

type Coords = { lat: number; lng: number; accuracy: number | null };
interface Sent {
  placeName: string;
  handler: Handler | null;
  national: Channel[];
}

const button = "w-full rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-40";

export function ReportFlow({ authFetch, onSent }: { authFetch: (url: string, init?: RequestInit) => Promise<Response>; onSent: () => void }) {
  const [group, setGroup] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof readPhotoMeta>> | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);

  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p)), [previews]);

  const locate = () => {
    setGeoError(null);
    if (!("geolocation" in navigator)) return setGeoError("This device cannot share its location.");
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? null }),
      () => setGeoError("We could not get your location. Allow location for this site and try again."),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const pick = async (files: FileList | null) => {
    if (!files) return;
    const originals = Array.from(files).slice(0, LIMITS.photosPerReport);
    setMeta(originals[0] ? await readPhotoMeta(originals[0]) : null);
    const picked = await Promise.all(originals.map((f) => shrinkPhoto(f)));
    setPhotos(picked);
    setPreviews(picked.map((f) => URL.createObjectURL(f)));
    if (!coords) locate();
  };

  const isOther = group === OTHER_KEY;
  const ready = photos.length > 0 && coords && group && (isOther ? note.trim() : type) && !busy;

  const submit = async () => {
    if (!coords || !group) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      photos.forEach((p) => fd.append("photos", p));
      fd.append("lat", String(coords.lat));
      fd.append("lng", String(coords.lng));
      if (coords.accuracy != null) fd.append("accuracy", String(coords.accuracy));
      fd.append("category", group);
      if (type && !isOther) fd.append("subcategory", type);
      if (note.trim()) fd.append("note", note.trim());
      if (meta?.takenAt) fd.append("takenAt", meta.takenAt);
      if (meta?.lat != null && meta.lng != null) {
        fd.append("photoLat", String(meta.lat));
        fd.append("photoLng", String(meta.lng));
      }
      const res = await authFetch("/api/sightings", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setError(json.error ?? "Something went wrong. Please try again.");
      setSent(json.data);
      onSent();
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setGroup(null);
    setType(null);
    setNote("");
    setPhotos([]);
    setPreviews([]);
    setSent(null);
  };

  if (sent) {
    return (
      <div className="space-y-4">
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Sent. Thank you.</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          We check every report before it appears on the {sent.placeName} pages. Follow it under My reports.
        </p>
        {sent.handler ? (
          <HandlerCard handler={sent.handler} national={sent.national} />
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">This is recorded for the public record; no body takes complaints for it.</p>
        )}
        <button type="button" onClick={reset} className={button}>
          Report something else
        </button>
      </div>
    );
  }

  const selected = REPORT_GROUPS.find((g) => g.key === group);
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">1. What did you see?</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[...REPORT_GROUPS, { key: OTHER_KEY, label: "Something else", hint: "Describe it in your words", icon: "", color: "#475569" }].map((g) => {
            const Icon = ICONS[g.icon] ?? MessageCircle;
            const on = group === g.key;
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => {
                  setGroup(g.key);
                  setType(null);
                }}
                aria-pressed={on}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                  on ? "border-cyan-700 bg-cyan-50 dark:bg-cyan-950" : "border-slate-200 hover:border-slate-400 dark:border-slate-700"
                }`}
              >
                <Icon className="h-5 w-5" style={{ color: g.color }} aria-hidden="true" />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{g.label}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{g.hint}</span>
              </button>
            );
          })}
        </div>
        {selected && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.types.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                aria-pressed={type === t.key}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  type === t.key
                    ? "border-cyan-700 bg-cyan-700 text-white"
                    : "border-slate-300 text-slate-700 hover:border-slate-500 dark:border-slate-600 dark:text-slate-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {group && (
          <label className="mt-3 block">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {isOther ? "What did you see? (needed)" : "Anything to add? (optional, seen only by our reviewer)"}
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, LIMITS.noteChars))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">2. Photos</h3>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-6 text-sm text-slate-600 hover:border-slate-500 dark:border-slate-600 dark:text-slate-400">
          <Camera className="h-5 w-5" aria-hidden="true" />
          {photos.length ? "Change photos" : `Take or choose up to ${LIMITS.photosPerReport} photos`}
          <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => pick(e.target.files)} />
        </label>
        {previews.length > 0 && (
          <div className="mt-2 flex gap-2">
            {previews.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" className="h-20 w-20 rounded object-cover" />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">3. Where is it?</h3>
        {coords ? (
          <>
            <LocationMap lat={coords.lat} lng={coords.lng} onChange={(lat, lng) => setCoords((c) => ({ lat, lng, accuracy: c?.accuracy ?? null }))} />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Drag the pin if it is off.{coords.accuracy != null && ` Phone accuracy about ${Math.round(coords.accuracy)} m.`}
            </p>
          </>
        ) : (
          <button type="button" onClick={locate} className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">
            Use my location
          </button>
        )}
        {geoError && <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">{geoError}</p>}
        {group === "drinking" && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Tap-water reports show publicly at ward or village level only, never your exact location.</p>
        )}
      </section>

      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      <button type="button" disabled={!ready} onClick={submit} className={`${button} inline-flex items-center justify-center gap-2`}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {busy ? "Sending" : "Send report"}
      </button>
    </div>
  );
}
