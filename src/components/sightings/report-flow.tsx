"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, CloudRain, Construction, Droplets, EyeOff, GlassWater, ImageIcon, ImagePlus,
  Loader2, LocateFixed, Lock, MapPin, MessageCircle, Plus, Search, Send, Sprout, Trash2, Waves, Wrench, X,
  type LucideIcon,
} from "lucide-react";

import { LIMITS, REVIEW_WITHIN_DAYS } from "@/lib/sightings/limits";
import { PARAMETERS, assess } from "@/lib/sightings/parameters";
import { OTHER_KEY, REPORT_GROUPS, WATER_SOURCES, takesReadings } from "@/lib/sightings/taxonomy";
import type { Handler, PublicReport } from "@/lib/sightings/types";
import type { Channel } from "@/lib/sightings/routing/types";
import { ActionButton } from "./action-feedback";
import { HandlerCard, NationalOnly } from "./handler-card";
import { PhotoBlur } from "./photo-blur";
import { ReminderLink } from "./reminder";
import { Readings, day } from "./report-card";
import { btn, enter, field, fieldBox, fileFocus, link, muted, rule, serif } from "./ui";
import { readPhotoMeta, shrinkPhoto } from "./use-citizen";

const LocationMap = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100 dark:bg-slate-800" />,
});

const ICONS: Record<string, LucideIcon> = { Trash2, Droplets, Waves, GlassWater, Wrench, CloudRain, Construction, Sprout };
const GROUPS = [...REPORT_GROUPS, { key: OTHER_KEY, label: "Something else", hint: "Describe it in your own words", icon: "", color: "#475569", types: [] }];

const STEPS = ["Photo", "What", "Where", "Send"];
const TITLES = ["Start with a photo", "What does it show?", "Where is it?", "Check and send"];
const WATER_TEST = "water_test";
const OLD_PHOTO_DAYS = 30;

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
type Shot = { file: File; url: string; meta: Awaited<ReturnType<typeof readPhotoMeta>> };
type Coords = { lat: number; lng: number; accuracy: number | null };
export type View = { lat: number; lng: number; zoom: number };
type Hit = { name: string; lat: number; lng: number };
type PinFrom = "photo" | "device" | "map";
/** What the server says about a pin, keyed by the pin it was asked about. */
type Place = { key: string; name?: string; outside?: boolean; failed?: boolean };
interface Sent {
  id: string;
  placeName: string;
  handler: Handler | null;
  national: Channel[];
  readings: PublicReport["readings"];
  role: string | null;
}

const PIN_FROM: Record<PinFrom, string> = { photo: "from your photo", device: "your phone's location", map: "placed on the map" };
const chip =
  "h-10 rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 aria-pressed:border-cyan-700 aria-pressed:bg-cyan-700 aria-pressed:text-white " +
  "dark:border-slate-600 dark:text-slate-300";

/** Filed with the body straight away: the reference is saved now, while the report is still being checked. */
function Filed({ id, body: handlerBody, authFetch }: { id: string; body: string; authFetch: Fetch }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(handlerBody);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("event", "reported");
    fd.append("authorityBody", body.trim());
    if (reference.trim()) fd.append("reference", reference.trim());
    const res = await authFetch(`/api/sightings/${id}/events`, { method: "POST", body: fd }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) return setError(json.error ?? "Could not save. Please try again.");
    setSaved(true);
  };

  if (saved) {
    return (
      <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
        <Check className="h-4 w-4" aria-hidden="true" />
        Saved. Your report will show as reported once it is published.
      </p>
    );
  }
  if (!open) {
    return (
      <p className="text-sm text-slate-800 dark:text-slate-200">
        Filed it already?{" "}
        <button type="button" onClick={() => setOpen(true)} className={link}>
          Save the reference number
        </button>
      </p>
    );
  }
  return (
    <div className={`space-y-4 rounded-xl bg-slate-50 p-4 sm:p-5 dark:bg-slate-900 ${enter}`}>
      <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
        Reported to
        <input value={body} onChange={(e) => setBody(e.target.value.slice(0, 160))} className={`${field} mt-1.5`} />
      </label>
      <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
        Reference or complaint number <span className={`font-normal ${muted}`}>Only you and our reviewer see it</span>
        <input value={reference} onChange={(e) => setReference(e.target.value.slice(0, 80))} className={`${field} mt-1.5`} />
      </label>
      <div className="flex gap-2">
        <ActionButton label="Save" busyLabel="Saving…" busy={busy} disabled={!body.trim()} onClick={save} className={btn("primary", "md")} />
        <button type="button" onClick={() => setOpen(false)} className={btn("quiet", "md")}>
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/** Photo, what, where, send: one decision per screen, with a live summary beside it on wide screens. */
export function ReportFlow({ authFetch, onSent, onOpenMine, view }: { authFetch: Fetch; onSent: () => void; onOpenMine: () => void; view?: View | null }) {
  const [step, setStep] = useState(0);
  const [shots, setShots] = useState<Shot[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [group, setGroup] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [source, setSource] = useState<string | null>(null);
  // Water-test results by parameter key, as typed; TDS is offered first.
  const [values, setValues] = useState<Record<string, string>>({ tds: "" });
  const [coords, setCoords] = useState<Coords | null>(null);
  const [pinFrom, setPinFrom] = useState<PinFrom | null>(null);
  // Bumped when the pin moves by itself (photo, GPS) or a search result is picked, so the map recentres; a tap or a drag keeps the view.
  const [mapKey, setMapKey] = useState(0);
  const [focus, setFocus] = useState<View | null>(null);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [blurring, setBlurring] = useState<number | null>(null);
  const [finding, setFinding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const shotsRef = useRef(shots);

  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);
  // Each new screen takes focus at its heading, so a screen reader starts there; not on first load.
  useEffect(() => {
    if (moved.current) heading.current?.focus({ preventScroll: true });
  }, [step, sent]);

  const key = coords ? `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}` : null;
  useEffect(() => {
    if (!key) return;
    let live = true;
    const t = setTimeout(() => {
      const [lat, lng] = key.split(",");
      authFetch(`/api/sightings/locate?lat=${lat}&lng=${lng}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j) => {
          if (!live) return;
          const d = j.data as { placeName: string; where: string | null } | null;
          setPlace(d ? { key, name: [d.where, d.placeName].filter(Boolean).join(", ") } : { key, outside: true });
        })
        .catch(() => live && setPlace({ key, failed: true }));
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [key, authFetch]);
  const here = place && place.key === key ? place : null;

  const locate = () => {
    setGeoError(null);
    if (!("geolocation" in navigator)) return setGeoError("This device cannot share its location. Tap the map where it is.");
    setFinding(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setFinding(false);
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? null });
        setPinFrom("device");
        setFocus(null);
        setMapKey((k) => k + 1);
      },
      () => {
        setFinding(false);
        setGeoError("We could not get your location. Allow location for this site, or tap the map where it is.");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const photoGps = shots.find((s) => s.meta.lat != null && s.meta.lng != null)?.meta;
  const pinToPhoto = (m: Shot["meta"]) => {
    setCoords({ lat: m.lat!, lng: m.lng!, accuracy: null });
    setPinFrom("photo");
    setFocus(null);
    setMapKey((k) => k + 1);
  };

  // A camera photo is taken at the spot, so the phone's location is the spot's; a gallery photo may be from anywhere.
  const pick = async (files: FileList | null, via: "camera" | "gallery") => {
    const chosen = Array.from(files ?? [])
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, LIMITS.photosPerReport - shots.length);
    if (!chosen.length) return;
    setPreparing(chosen.length);
    const added = await Promise.all(
      chosen.map(async (f) => {
        const [meta, file] = await Promise.all([readPhotoMeta(f), shrinkPhoto(f)]);
        return { file, url: URL.createObjectURL(file), meta };
      }),
    );
    setPreparing(0);
    setShots((s) => [...s, ...added].slice(0, LIMITS.photosPerReport));
    // A photo that knows where it was taken places the pin, so reporting later from home still lands at the spot.
    const gps = added.find((s) => s.meta.lat != null && s.meta.lng != null);
    if (gps && pinFrom !== "map" && pinFrom !== "photo") pinToPhoto(gps.meta);
    else if (!coords && !gps && !finding && via === "camera") locate();
  };

  const findPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim().length < 3) return;
    setSearching(true);
    setSearchError(null);
    const res = await authFetch(`/api/sightings/search?q=${encodeURIComponent(search.trim())}`).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setSearching(false);
    if (!res?.ok) return setSearchError(json.error ?? "Search is not working right now. Tap the map instead.");
    setHits(json.data);
  };

  const goTo = (h: Hit) => {
    setFocus({ lat: h.lat, lng: h.lng, zoom: 16 });
    setMapKey((k) => k + 1);
    setHits(null);
  };

  const blurred = (i: number, file: File) => {
    const url = URL.createObjectURL(file);
    URL.revokeObjectURL(shots[i].url);
    setShots((s) => s.map((x, j) => (j === i ? { ...x, file, url } : x)));
    setBlurring(null);
  };

  const removeShot = (i: number) => {
    URL.revokeObjectURL(shots[i].url);
    setShots((s) => s.filter((_, j) => j !== i));
  };

  const selected = GROUPS.find((g) => g.key === group);
  const isOther = group === OTHER_KEY;
  const testing = !!group && takesReadings(group, type);
  const entered = Object.entries(values).filter(([, v]) => v.trim() !== "");
  const typeLabel = isOther ? note.trim() || null : (selected?.types.find((t) => t.key === type)?.label ?? null);
  const takenAt = shots[0]?.meta.takenAt;
  const oldPhoto = takenAt && Date.now() - new Date(takenAt).getTime() > OLD_PHOTO_DAYS * 86_400_000 ? takenAt : null;

  // Why each screen cannot move on yet; null = ready.
  const blockers = [
    !shots.length ? "Add at least one photo." : here?.outside ? "This spot is outside the places we cover." : null,
    !group
      ? "Choose what it shows."
      : isOther
        ? note.trim() ? null : "Describe what you saw."
        : !type
          ? "Choose the closest type."
          : testing && !entered.length
            ? "Enter at least one result."
            : testing && !source
              ? "Choose where the water is from."
              : null,
    !coords ? "Place the pin on the map." : here?.outside ? "This spot is outside the places we cover." : !here ? "Finding the place…" : null,
    null,
  ];
  const reachable = (i: number) => blockers.slice(0, i).every((b) => b === null);

  const go = (i: number) => {
    moved.current = true;
    setStep(i);
    if ((top.current?.getBoundingClientRect().top ?? 0) < 0) top.current?.scrollIntoView({ block: "start" });
  };

  const submit = async () => {
    if (!coords || !group) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      shots.forEach((s) => fd.append("photos", s.file));
      fd.append("lat", String(coords.lat));
      fd.append("lng", String(coords.lng));
      if (coords.accuracy != null) fd.append("accuracy", String(coords.accuracy));
      fd.append("category", group);
      if (type && !isOther) fd.append("subcategory", type);
      if (note.trim()) fd.append("note", note.trim());
      if (group === "drinking" && source) fd.append("waterSource", source);
      if (testing) entered.forEach(([k, v]) => fd.append(`reading.${k}`, v.trim()));
      const meta = shots[0]?.meta;
      if (meta?.takenAt) fd.append("takenAt", meta.takenAt);
      if (meta?.lat != null && meta.lng != null) {
        fd.append("photoLat", String(meta.lat));
        fd.append("photoLng", String(meta.lng));
      }
      const res = await authFetch("/api/sightings", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setError(json.error ?? "Something went wrong. Please try again.");
      moved.current = true;
      setSent(json.data);
      onSent();
      top.current?.scrollIntoView({ block: "start" });
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    shots.forEach((s) => URL.revokeObjectURL(s.url));
    setShots([]);
    setGroup(null);
    setType(null);
    setNote("");
    setSource(null);
    setValues({ tds: "" });
    setCoords(null);
    setPinFrom(null);
    setPlace(null);
    setFocus(null);
    setSearch("");
    setHits(null);
    setGeoError(null);
    setError(null);
    setSent(null);
    go(0);
  };

  if (sent) {
    const routed = sent.handler || (sent.role && sent.national.length > 0);
    return (
      <div ref={top} className={`grid scroll-mt-24 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-20 ${enter}`}>
        <div className="space-y-5">
          <CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <h2 ref={heading} tabIndex={-1} className={`${serif} text-3xl leading-tight focus:outline-none sm:text-4xl`}>
            Thank you. Your report is in.
          </h2>
          <p className={`max-w-[48ch] text-lg leading-relaxed ${muted}`}>
            We check every report before it appears on the {sent.placeName} pages, usually within {REVIEW_WITHIN_DAYS} days. Follow it, and
            keep its status up to date, under My reports.
          </p>
          {sent.readings.length > 0 && <Readings readings={sent.readings} />}
          {routed && <ReminderLink />}
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" onClick={reset} className={btn("primary")}>
              <Camera className="h-4 w-4" aria-hidden="true" />
              Report something else
            </button>
            <button type="button" onClick={onOpenMine} className={btn("secondary")}>
              Go to My reports
            </button>
          </div>
        </div>
        <div className="space-y-4">
          {sent.handler ? (
            <HandlerCard handler={sent.handler} national={sent.national} />
          ) : routed ? (
            <NationalOnly national={sent.national} />
          ) : (
            <p className={muted}>No public body takes complaints for this kind of report. It goes on the public record for the place.</p>
          )}
          {routed && <Filed id={sent.id} body={sent.handler?.body ?? ""} authFetch={authFetch} />}
        </div>
      </div>
    );
  }

  const locationLine = (
    <p className={`flex min-w-0 items-start gap-2 text-sm ${here?.outside || (!coords && geoError) ? "text-amber-800 dark:text-amber-300" : ""}`} aria-live="polite">
      {finding || (coords && !here) ? (
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden="true" />
      ) : (
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
      )}
      <span className="min-w-0">
        {finding ? (
          "Finding where you are…"
        ) : !coords ? (
          (geoError ?? (step === 0 ? "This photo has no location in it." : "No location yet. Tap the map where it is."))
        ) : here?.outside ? (
          <>
            This spot is outside the cities, districts and river basins we cover so far.{" "}
            <a href="#where" className="underline underline-offset-2">
              See where you can report
            </a>
          </>
        ) : here ? (
          <>
            {here.name && <span className="font-semibold text-slate-900 dark:text-slate-100">{here.name}</span>}
            <span className={muted}>
              {here.name ? ", " : "Location set, "}
              {pinFrom && PIN_FROM[pinFrom]}
              {pinFrom === "device" && coords.accuracy != null && `, about ${Math.round(coords.accuracy)} m`}
            </span>
          </>
        ) : (
          "Finding the place…"
        )}
      </span>
    </p>
  );

  const addInput = <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void pick(e.target.files, "gallery"); e.target.value = ""; }} />;

  const photoStep = (
    <>
      {shots.length + preparing === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void pick(e.dataTransfer.files, "gallery");
          }}
          className={`grid gap-3 rounded-xl transition-colors pointer-fine:place-items-center pointer-fine:border pointer-fine:border-dashed pointer-fine:px-6 pointer-fine:py-14 ${
            dragging ? "border-cyan-600 bg-cyan-50/70 dark:bg-cyan-950/40" : "border-slate-300 dark:border-slate-700"
          }`}
        >
          <label className={`${btn("primary", "xl")} ${fileFocus} w-full pointer-fine:hidden`}>
            <Camera className="h-5 w-5" aria-hidden="true" />
            Take a photo
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void pick(e.target.files, "camera"); e.target.value = ""; }} />
          </label>
          <label className={`${btn("secondary", "xl")} ${fileFocus} w-full pointer-fine:hidden`}>
            {addInput}
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
            Choose from gallery
          </label>
          <ImagePlus className="h-8 w-8 text-slate-400 pointer-coarse:hidden" aria-hidden="true" />
          <label className={`${btn("primary")} ${fileFocus} pointer-coarse:hidden`}>
            {addInput}{" "}
            Choose photos
          </label>
          <p className={`text-sm pointer-coarse:hidden ${muted}`}>or drop them here</p>
        </div>
      ) : (
        <>
          <ul className="grid max-w-xl grid-cols-3 gap-2 sm:gap-3">
            {shots.map((s, i) => (
              <li key={s.url} className={`relative aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 ${enter}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setBlurring(i)}
                  className="absolute bottom-1.5 left-1.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-900/70 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-white"
                >
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  Blur<span className="sr-only"> part of photo {i + 1}</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeShot(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute top-1.5 right-1.5 grid h-8 w-8 place-items-center rounded-full bg-slate-900/70 text-white transition-colors hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-white"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
            {Array.from({ length: preparing }, (_, i) => (
              <li key={`p${i}`} className="grid aspect-square place-items-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label="Preparing photo" />
              </li>
            ))}
            {shots.length + preparing < LIMITS.photosPerReport && (
              <li>
                <label
                  className={`${fileFocus} flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800`}
                >
                  <Plus className="h-5 w-5" aria-hidden="true" />
                  Add
                  {addInput}
                </label>
              </li>
            )}
          </ul>
          {locationLine}
          {!coords && !finding && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button type="button" onClick={locate} className={btn("secondary", "md")}>
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
                I am at the spot: use my location
              </button>
              <span className={`text-sm ${muted}`}>Not there now? You will place it on the map.</span>
            </div>
          )}
          {here?.outside && (
            <button
              type="button"
              onClick={() => {
                setCoords(null);
                setPinFrom(null);
              }}
              className={btn("quiet", "sm")}
            >
              The location is wrong: I will place it on the map
            </button>
          )}
          {oldPhoto && (
            <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              This photo is from {day(oldPhoto)}. A report should show the place as it is now.
            </p>
          )}
          {blurring != null && shots[blurring] && (
            <PhotoBlur src={shots[blurring].url} onDone={(f) => blurred(blurring, f)} onClose={() => setBlurring(null)} />
          )}
        </>
      )}
    </>
  );

  const GroupIcon = ICONS[selected?.icon ?? ""] ?? MessageCircle;
  const whatStep = !selected ? (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => {
          setGroup("drinking");
          setType(WATER_TEST);
        }}
        className={`inline-flex items-center gap-1.5 text-sm ${link}`}
      >
        <GlassWater className="h-4 w-4" aria-hidden="true" />
        Have water test results? Add them
      </button>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {GROUPS.map((g) => {
          const Icon = ICONS[g.icon] ?? MessageCircle;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => {
                setGroup(g.key);
                setType(null);
              }}
              className="flex min-h-28 flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-3.5 text-left transition-[border-color,background-color,transform] duration-200 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 active:translate-y-px dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500 dark:hover:bg-slate-800"
            >
              <Icon className="h-5 w-5" style={{ color: g.color }} aria-hidden="true" />
              <span className="font-semibold leading-snug text-slate-900 dark:text-slate-100">{g.label}</span>
              <span className={`text-xs leading-snug ${muted}`}>{g.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  ) : (
    <div className={`space-y-7 ${enter}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <GroupIcon className="h-5 w-5" style={{ color: selected.color }} aria-hidden="true" />
          {selected.label}
        </p>
        <button
          type="button"
          className={btn("quiet", "sm")}
          onClick={() => {
            setGroup(null);
            setType(null);
          }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Change
        </button>
      </div>
      {isOther ? (
        <label className="block">
          <span className="font-medium text-slate-900 dark:text-slate-100">What did you see?</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, LIMITS.noteChars))}
            rows={3}
            placeholder="One line is enough"
            className={`${field} mt-2`}
          />
        </label>
      ) : (
        <fieldset>
          <legend className="sr-only">Closest type</legend>
          <ul className={`divide-y border-y ${rule}`}>
            {selected.types.map((t) => (
              <li key={t.key}>
                <label className="flex cursor-pointer items-center gap-3 px-1 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900">
                  <input
                    type="radio"
                    name="report-type"
                    value={t.key}
                    checked={type === t.key}
                    onChange={() => setType(t.key)}
                    className="h-[1.125rem] w-[1.125rem] shrink-0 accent-cyan-700"
                  />
                  <span className="text-slate-900 dark:text-slate-100">{t.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      {group === "drinking" && (
        <fieldset>
          <legend className="font-medium text-slate-900 dark:text-slate-100">
            Where is the water from?{!testing && <span className={`font-normal ${muted}`}> Optional</span>}
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {WATER_SOURCES.map((w) => (
              <button key={w.key} type="button" aria-pressed={source === w.key} onClick={() => setSource(source === w.key ? null : w.key)} className={chip}>
                {w.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {testing && (
        <fieldset>
          <legend className="font-medium text-slate-900 dark:text-slate-100">Your results</legend>
          <p className={`mt-1 text-sm ${muted}`}>What your meter or kit shows; TDS alone is fine. Your photo should show the reading.</p>
          <div className={`mt-3 divide-y border-y ${rule}`}>
            {PARAMETERS.filter((p) => p.key in values).map((p) => {
              const raw = values[p.key];
              const warn = raw !== "" && Number.isFinite(Number(raw)) ? assess(p, Number(raw)) : null;
              const set = (v: string) => setValues((x) => ({ ...x, [p.key]: v }));
              return (
                <div key={p.key} className="py-3">
                  <label className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 text-slate-900 dark:text-slate-100">{p.name}</span>
                    {p.limit.kind === "absent" ? (
                      <select value={raw} onChange={(e) => set(e.target.value)} className={`${fieldBox} w-40`}>
                        <option value="">Choose</option>
                        <option value="1">Detected</option>
                        <option value="0">Not detected</option>
                      </select>
                    ) : (
                      <>
                        <input
                          inputMode="decimal"
                          value={raw}
                          onChange={(e) => set(e.target.value.replace(/[^0-9.]/g, ""))}
                          className={`${fieldBox} w-24 text-right tabular-nums`}
                        />
                        <span className={`w-16 text-xs leading-tight ${muted}`}>{p.unit}</span>
                      </>
                    )}
                  </label>
                  {warn && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-sm text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {warn[0].toUpperCase() + warn.slice(1)}.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {PARAMETERS.some((p) => !(p.key in values)) && (
            <select
              value=""
              onChange={(e) => e.target.value && setValues((v) => ({ ...v, [e.target.value]: "" }))}
              className={`${fieldBox} mt-3 block`}
              aria-label="Add a measurement"
            >
              <option value="">+ Add a measurement</option>
              {PARAMETERS.filter((p) => !(p.key in values)).map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </fieldset>
      )}
    </div>
  );

  const whereStep = (
    <>
      <form onSubmit={findPlace} role="search" className="space-y-2">
        <div className="flex gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a place, e.g. a lake, road or village"
            aria-label="Search a place"
            className={`${field} min-w-0 flex-1`}
          />
          <ActionButton
            label="Find"
            busyLabel="Finding…"
            busy={searching}
            disabled={search.trim().length < 3}
            type="submit"
            icon={<Search className="h-4 w-4" aria-hidden="true" />}
            className={btn("secondary", "lg")}
          />
        </div>
        {searchError && <p className="text-sm text-amber-800 dark:text-amber-300">{searchError}</p>}
        {hits && (
          <div className={`text-sm ${enter}`}>
            {hits.length === 0 ? (
              <p className={muted}>No place found by that name. Try a nearby landmark, or tap the map.</p>
            ) : (
              <ul className={`divide-y border-y ${rule}`}>
                {hits.map((h) => (
                  <li key={`${h.lat},${h.lng}`}>
                    <button type="button" onClick={() => goTo(h)} className="w-full px-1 py-2.5 text-left text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-900">
                      {h.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className={`mt-1.5 text-xs ${muted}`}>Search by OpenStreetMap Nominatim.</p>
          </div>
        )}
      </form>
      <div className={`isolate h-72 overflow-hidden rounded-xl border sm:h-96 ${rule}`}>
        <LocationMap
          key={mapKey}
          lat={coords?.lat ?? null}
          lng={coords?.lng ?? null}
          focus={focus ?? (coords ? null : view)}
          onChange={(lat, lng) => {
            setCoords({ lat, lng, accuracy: null });
            setPinFrom("map");
          }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {locationLine}
        <div className="-mx-3 flex flex-wrap sm:mx-0">
          {photoGps && pinFrom !== "photo" && (
            <button type="button" onClick={() => pinToPhoto(photoGps)} className={btn("quiet", "sm")}>
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              Photo&rsquo;s location
            </button>
          )}
          <button type="button" onClick={locate} disabled={finding} className={btn("quiet", "sm")}>
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            My location
          </button>
        </div>
      </div>
      {group === "drinking" && <p className={`text-sm ${muted}`}>Shown publicly at ward or village level only, never this point.</p>}
    </>
  );

  const sourceLabel = WATER_SOURCES.find((w) => w.key === source)?.label;
  const rows: [string, React.ReactNode][] = [
    ["What", typeLabel && <span className="line-clamp-2">{typeLabel}</span>],
    ["Where", here?.name ?? (coords ? "Pin placed" : null)],
    ...(sourceLabel ? [["Water from", sourceLabel] as [string, string]] : []),
    ...(testing && entered.length
      ? [["Results", entered.map(([k, v]) => `${PARAMETERS.find((p) => p.key === k)?.name} ${v}`).join(", ")] as [string, string]]
      : []),
  ];
  /** The report as it stands: a large photo beside the steps on wide screens, a thumbnail row on the phone's last step. */
  const draft = (compact: boolean) => (
    <div className={compact ? "flex gap-4" : "space-y-4"}>
      {!compact && <p className={`text-sm font-medium ${muted}`}>Your report</p>}
      <div className={`shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800 ${compact ? "h-20 w-20 rounded-lg" : "aspect-[4/3] rounded-xl"}`}>
        {shots[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shots[0].url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-slate-400">
            <ImageIcon className="h-8 w-8" aria-hidden="true" />
          </div>
        )}
      </div>
      <dl className={`min-w-0 flex-1 divide-y text-sm ${compact ? "-mt-2.5" : "border-y"} ${rule}`}>
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5">
            <dt className={muted}>{k}</dt>
            <dd className="min-w-0 text-right font-medium text-slate-900 dark:text-slate-100">{v || <span className="font-normal text-slate-400">Not yet</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  const sendStep = (
    <>
      <div className="lg:hidden">{draft(true)}</div>
      {!isOther && (
        <label className="block">
          <span className="font-medium text-slate-900 dark:text-slate-100">Anything our reviewer should know?</span>
          <span className={`block text-sm ${muted}`}>Optional. Never published.</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, LIMITS.noteChars))} rows={3} className={`${field} mt-2`} />
        </label>
      )}
      <p className={`flex items-start gap-2 text-sm ${muted}`}>
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Your name and email never appear with this report.{" "}
          <a href="#privacy" className={link}>
            How we protect you
          </a>
        </span>
      </p>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </>
  );

  const subtitle = [
    "Of the problem itself, at the spot, with no faces, vehicle number plates or house names or numbers (you can blur them). For a water test, photograph the meter or kit showing the reading.",
    selected ? null : "Pick the closest. If nothing fits, choose Something else.",
    focus && !coords ? "Now tap the exact spot on the map." : "Tap the map or drag the pin to the exact spot. Far from here? Search for the place.",
    null,
  ][step];

  return (
    <div ref={top} className="grid scroll-mt-24 gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-16">
      <div className="min-w-0">
        <ol className="grid grid-cols-4 gap-2 sm:gap-3" aria-label="Steps">
          {STEPS.map((s, i) => {
            const now = i === step;
            return (
              <li key={s}>
                <button
                  type="button"
                  disabled={now || !reachable(i)}
                  onClick={() => go(i)}
                  aria-current={now ? "step" : undefined}
                  className="group/step w-full rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-500"
                >
                  <span className={`block h-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-cyan-700 dark:bg-cyan-500" : "bg-slate-200 dark:bg-slate-800"}`} />
                  <span
                    className={`mt-2 flex items-center gap-1.5 text-xs font-semibold sm:text-sm ${
                      now
                        ? "text-slate-900 dark:text-slate-100"
                        : i < step
                          ? "text-cyan-800 group-enabled/step:group-hover/step:underline dark:text-cyan-400"
                          : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {i < step ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <span className="tabular-nums">{i + 1}</span>}
                    {s}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div key={step} className={`mt-9 space-y-6 ${enter}`}>
          <div>
            <h2 ref={heading} tabIndex={-1} className={`${serif} text-[1.75rem] leading-tight focus:outline-none sm:text-3xl`}>
              {TITLES[step]}
            </h2>
            {subtitle && <p className={`mt-2 max-w-[60ch] ${muted}`}>{subtitle}</p>}
          </div>
          {[photoStep, whatStep, whereStep, sendStep][step]}
        </div>

        <div
          className={`sticky bottom-0 z-10 -mx-4 mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mt-10 sm:flex-nowrap sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none ${rule}`}
        >
          {blockers[step] && <p className={`w-full text-sm sm:hidden ${muted}`}>{blockers[step]}</p>}
          {step > 0 && (
            <button type="button" onClick={() => go(step - 1)} className={btn("quiet", "lg")}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
          )}
          <p className={`ml-auto hidden text-sm sm:block ${muted}`} aria-live="polite">
            {blockers[step]}
          </p>
          {step < 3 ? (
            <button type="button" disabled={!!blockers[step]} onClick={() => go(step + 1)} className={`${btn("primary")} ml-auto min-w-32 sm:ml-0`}>
              Next
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <ActionButton
              label="Send report"
              busyLabel="Sending…"
              busy={busy}
              onClick={submit}
              icon={<Send className="h-4 w-4" aria-hidden="true" />}
              className={`${btn("primary")} ml-auto min-w-40 sm:ml-0`}
            />
          )}
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24">{draft(false)}</div>
      </aside>
    </div>
  );
}
