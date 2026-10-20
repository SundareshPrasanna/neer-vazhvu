"use client";

import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, EyeOff, ImageIcon, Loader2, LocateFixed, Lock, MapPin, Plus, Search, X } from "lucide-react";

import { LIMITS, REVIEW_WITHIN_DAYS } from "@/lib/sightings/limits";
import { PARAMETERS } from "@/lib/sightings/parameters";
import { longEnough, suggestQuery, type Suggestion } from "@/lib/sightings/suggest";
import { EXTENTS, OTHER_KEY, WATER_SOURCES, isCommunityReport, takesReadings } from "@/lib/sightings/taxonomy";
import { TEST_INSTRUMENTS, testLabel } from "@/lib/sightings/test-meta";
import type { Handler, NearbyIssue, NearbyWater, PublicReport } from "@/lib/sightings/types";
import type { Channel } from "@/lib/sightings/routing/types";
import { ActionButton } from "./action-feedback";
import { Choice } from "./choice";
import { OUTBOX_MAX, clearDraft, enqueue, fromStored, loadDraft, saveDraft, toStored, type StoredFile } from "./draft-store";
import { GoogleButton } from "./google-button";
import { HandlerCard, NationalOnly } from "./handler-card";
import { NotifyToggle } from "./notify-toggle";
import { PhotoBlur } from "./photo-blur";
import { ReminderLink } from "./reminder";
import { Readings, day } from "./report-card";
import { SameIssueCard, useSameIssue } from "./same-issue";
import { btn, enter, field, fileFocus, link, muted, rule, headingCls } from "./ui";
import { useMyGroups } from "./groups-panel";
import { readPhotoMeta, shrinkPhoto, type useCitizen } from "./use-citizen";
import { EMPTY_FORM, WhatStep, chosen, seenAtLabel, whatBlocker, whatHeading, whatLabel, type Form, type Screen } from "./what-step";

const LocationMap = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100 dark:bg-slate-800" />,
});

const STEPS = ["Photo", "What", "Where", "Send"];
const TITLES = ["Start with a photo", "", "Mark the exact spot", "Check and send"];
const OLD_PHOTO_DAYS = 30;

type Citizen = ReturnType<typeof useCitizen>;
type Fetch = Citizen["authFetch"];
type Meta = Awaited<ReturnType<typeof readPhotoMeta>>;
type Shot = { file: File; url: string; meta: Meta };
type Coords = { lat: number; lng: number; accuracy: number | null };
export type View = { lat: number; lng: number; zoom: number };
type Hit = { name: string; lat: number; lng: number };
type PinFrom = "photo" | "device" | "map";
/** What the server says about a pin, keyed by the pin it was asked about; `signIn` = it answers only once signed in. */
type Place = { key: string; name?: string; outside?: boolean; failed?: boolean; signIn?: boolean; nearby?: NearbyWater[] };
interface Sent {
  id: string;
  placeName: string;
  placeHref: string | null;
  placeLabel: string | null;
  handler: Handler | null;
  national: Channel[];
  readings: PublicReport["readings"];
  role: string | null;
}
/** Added to someone else's report instead of sending a new one. */
type Joined = { placeHref: string | null; photo: boolean };

/** The report as kept on the phone across the Google sign-in (draft-store.ts). */
interface Draft {
  v: 1;
  form: Form;
  coords: Coords | null;
  pinFrom: PinFrom | null;
  withGroup: string | null;
  notSame: string[];
  photos: { file: StoredFile; meta: Meta }[];
}

const PIN_FROM: Record<PinFrom, string> = { photo: "from your photo", device: "your phone's location", map: "placed on the map" };

/** Place search: what each suggestion is, and how close the map opens on it. */
const KIND_WORD: Record<Suggestion["kind"], string> = { lake: "Lake or tank", ward: "Ward", village: "Village", town: "Town" };
const KIND_ZOOM: Record<Suggestion["kind"], number> = { lake: 16, ward: 15, village: 14, town: 14 };
const NO_PLACE = "No covered place by that name. Try a nearby lake, ward or village, or move the map.";
const OPTION =
  "flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2.5 text-base hover:bg-slate-50 aria-selected:bg-slate-100 " +
  "dark:hover:bg-slate-800/60 dark:aria-selected:bg-slate-800";
const inIndia = (v: { lat: number; lng: number }) => v.lat >= 6 && v.lat <= 38 && v.lng >= 68 && v.lng <= 98;

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

const Problem = ({ text }: { text: string | null }) =>
  text ? (
    <p role="alert" className="flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-400">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {text}
    </p>
  ) : null;

/**
 * Photo, what, where, send: one decision per screen, with a live summary beside it on wide screens. Anyone can start;
 * signing in is asked for at Send, with the report kept on the phone meanwhile. A report that cannot reach us for
 * want of a connection waits on the phone (the outbox) and sends itself later.
 */
export function ReportFlow({ citizen, onSent, onOpenMine, view }: { citizen: Citizen; onSent: () => void; onOpenMine: () => void; view?: View | null }) {
  const { authFetch } = citizen;
  const owner = citizen.session?.user.id ?? null;
  const signedIn = !!owner;
  const [step, setStep] = useState(0);
  const [shots, setShots] = useState<Shot[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const [screen, setScreen] = useState<Screen>("place");
  // "Somewhere else" on the nearby question: show the whole list.
  const [askAll, setAskAll] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [pinFrom, setPinFrom] = useState<PinFrom | null>(null);
  // "Report another one here": the pin stays where it is, whatever the next photo says.
  const [held, setHeld] = useState(false);
  // Bumped when the pin moves by itself (photo, GPS) or a search result is picked, so the map recentres; a tap or a drag keeps the view.
  const [mapKey, setMapKey] = useState(0);
  const [focus, setFocus] = useState<View | null>(null);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // As-you-type suggestions from the places we cover, with the query they answer; Nominatim stays on submit only.
  const [suggested, setSuggested] = useState<{ q: string; list: Suggestion[]; failed?: boolean } | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const searchBox = useRef<HTMLInputElement>(null);
  const suggestCache = useRef(new Map<string, Suggestion[]>());
  const warmed = useRef(false);
  const [blurring, setBlurring] = useState<number | null>(null);
  const [finding, setFinding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState(false);
  // The phone would not keep the draft: the next tap on Continue with Google signs in anyway.
  const [unkept, setUnkept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [queued, setQueued] = useState(false);
  const [joined, setJoined] = useState<Joined | null>(null);
  const [restored, setRestored] = useState(false);
  // Nearby issues the person said are not this one.
  const [notSame, setNotSame] = useState<string[]>([]);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  // Reviewed groups the person can send with (null sends it alone); never for a home's water, which shows only the ward.
  const { data: myGroups } = useMyGroups(citizen);
  const { group, type } = chosen(form);
  const sendGroups = group && isCommunityReport(group) ? (myGroups?.groups.filter((g) => g.status === "approved") ?? []) : [];
  const [withGroup, setWithGroup] = useState<string | null>(null);
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
  }, [step, screen, sent, queued, joined]);

  // Back from signing in (or a reload mid-way): the report as it was left, on the Send step, for the person to send.
  useEffect(() => {
    let live = true;
    void loadDraft<Draft>().then((d) => {
      if (!live || d?.v !== 1) return;
      const restoredShots = d.photos.map((p) => {
        const file = fromStored(p.file);
        return { file, url: URL.createObjectURL(file), meta: p.meta };
      });
      setShots(restoredShots);
      setForm({ ...EMPTY_FORM, ...d.form });
      setCoords(d.coords);
      setPinFrom(d.pinFrom);
      setWithGroup(d.withGroup);
      setNotSame(d.notSame);
      setScreen("what");
      setMapKey((k) => k + 1);
      setRestored(true);
      moved.current = true;
      setStep(3);
    });
    return () => {
      live = false;
    };
  }, []);

  const key = coords ? `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)},${coords.accuracy == null ? "" : Math.round(coords.accuracy)}` : null;
  useEffect(() => {
    if (!key) return;
    let live = true;
    const t = setTimeout(() => {
      const [lat, lng, accuracy] = key.split(",");
      authFetch(`/api/sightings/locate?lat=${lat}&lng=${lng}${accuracy ? `&accuracy=${accuracy}` : ""}`)
        .then(async (r) => {
          if (!live) return;
          if (r.status === 401) return setPlace({ key, signIn: true });
          if (!r.ok) throw new Error(String(r.status));
          const d = (await r.json()).data as { placeName: string; where: string | null; nearby?: NearbyWater[] } | null;
          if (!live) return;
          setPlace(
            d
              ? { key, name: [d.where, d.placeName].filter(Boolean).join(", "), nearby: Array.isArray(d.nearby) ? d.nearby : [] }
              : { key, outside: true },
          );
        })
        .catch(() => live && setPlace({ key, failed: true }));
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // Asked again once signed in: before that the server may not answer.
  }, [key, authFetch, signedIn]);
  const here = place && place.key === key ? place : null;

  // Suggestions about 200 ms after typing stops, nearer the pin (else where the map opened) first; the centre is
  // rounded to about a kilometre, which is all the ranking needs.
  const typed = suggestQuery(search);
  const centre = coords ?? focus ?? view ?? null;
  const near = centre && inIndia(centre) ? `&lat=${centre.lat.toFixed(2)}&lng=${centre.lng.toFixed(2)}` : "";
  useEffect(() => {
    if (!listOpen || !longEnough(typed)) return;
    const query = `q=${encodeURIComponent(typed)}${near}`;
    const known = suggestCache.current.get(query);
    const ctrl = new AbortController();
    const show = (list: Suggestion[], failed?: boolean) => {
      setSuggested({ q: typed, list, failed });
      setActive(-1);
    };
    const t = setTimeout(
      () => {
        if (known) return show(known);
        fetch(`/api/sightings/suggest?${query}`, { signal: ctrl.signal })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then((j: { data?: Suggestion[] }) => {
            const list = Array.isArray(j.data) ? j.data : [];
            if (suggestCache.current.size > 100) suggestCache.current.clear();
            suggestCache.current.set(query, list);
            show(list);
          })
          .catch(() => !ctrl.signal.aborted && show([], true));
      },
      known ? 0 : 200,
    );
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [typed, near, listOpen]);
  useEffect(() => {
    if (active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const matches = useSameIssue(authFetch, coords, group, type, signedIn);
  const match: NearbyIssue | null = matches?.find((m) => !notSame.includes(m.issue.id)) ?? null;

  const locate = () => {
    setGeoError(null);
    if (!("geolocation" in navigator)) return setGeoError("This device cannot share its location. Tap the map where it is.");
    setFinding(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setFinding(false);
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? null });
        setPinFrom("device");
        setHeld(false);
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
  const pinToPhoto = (m: Meta) => {
    setCoords({ lat: m.lat!, lng: m.lng!, accuracy: null });
    setPinFrom("photo");
    setHeld(false);
    setFocus(null);
    setMapKey((k) => k + 1);
  };

  // A camera photo is taken at the spot, so the phone's location is the spot's; a gallery photo may be from anywhere.
  const pick = async (files: FileList | null, via: "camera" | "gallery") => {
    const picked = Array.from(files ?? [])
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, LIMITS.photosPerReport - shots.length);
    if (!picked.length) return;
    setPreparing(picked.length);
    const added = await Promise.all(
      picked.map(async (f) => {
        const [meta, file] = await Promise.all([readPhotoMeta(f), shrinkPhoto(f)]);
        return { file, url: URL.createObjectURL(file), meta };
      }),
    );
    setPreparing(0);
    setShots((s) => [...s, ...added].slice(0, LIMITS.photosPerReport));
    // A photo that knows where it was taken places the pin, so reporting later from home still lands at the spot.
    const gps = added.find((s) => s.meta.lat != null && s.meta.lng != null);
    if (held) return;
    if (gps && pinFrom !== "map" && pinFrom !== "photo") pinToPhoto(gps.meta);
    else if (!coords && !gps && !finding && via === "camera") locate();
  };

  const closeList = () => {
    setListOpen(false);
    setActive(-1);
  };

  /** Streets and addresses, from Nominatim through our server: on request only, and only signed in. */
  const searchAddress = async () => {
    closeList();
    if (search.trim().length < 3) return;
    setSearching(true);
    setSearchError(null);
    const res = await authFetch(`/api/sightings/search?q=${encodeURIComponent(search.trim())}`).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setSearching(false);
    if (res?.status === 401) return setSearchError("Place search works once you sign in. Move the map to the spot instead.");
    if (!res?.ok) return setSearchError(json.error ?? "Search is not working right now. Tap the map instead.");
    setHits(json.data);
  };
  const findPlace = (e: React.FormEvent) => {
    e.preventDefault();
    void searchAddress();
  };

  /** A covered place: the pin goes there and the map follows. A lake also answers "Where are you?" if it is still open. */
  const pickPlace = (s: Suggestion) => {
    setCoords({ lat: s.lat, lng: s.lng, accuracy: null });
    setPinFrom("map");
    setHeld(false);
    setFocus({ lat: s.lat, lng: s.lng, zoom: KIND_ZOOM[s.kind] });
    setMapKey((k) => k + 1);
    setSearch(s.label);
    closeList();
    setHits(null);
    setSearchError(null);
    if (s.kind === "lake" && !form.seenAt) {
      patch({ seenAt: "lake", group: null, type: null, homeIssue: null, smell: null, extent: null });
      setScreen("what");
    }
    // Closes the phone's keyboard, so the map shows.
    searchBox.current?.blur();
  };

  // The box's list: an answer for what is typed, else the last one while the next loads.
  const panelOpen = listOpen && longEnough(typed);
  const answer = suggested && suggested.q === typed ? suggested : null;
  const placeRows = panelOpen ? (answer ?? suggested)?.list ?? [] : [];
  const addressRow = panelOpen && search.trim().length >= 3;
  const optionCount = placeRows.length + (addressRow ? 1 : 0);
  const choose = (i: number) => (i < placeRows.length ? pickPlace(placeRows[i]) : addressRow ? void searchAddress() : undefined);
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!panelOpen) return setListOpen(true);
      setActive((a) => Math.min(a + 1, optionCount - 1));
    } else if (e.key === "ArrowUp" && panelOpen) {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Enter" && panelOpen && active >= 0 && active < optionCount) {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape" && panelOpen) {
      e.preventDefault();
      closeList();
    }
  };
  /** The first focus starts the server's index, so the first suggestions come sooner. */
  const warm = () => {
    if (warmed.current) return;
    warmed.current = true;
    void fetch("/api/sightings/suggest?q=").catch(() => undefined);
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

  const home = form.seenAt === "home";
  const isOther = group === OTHER_KEY;
  const testing = !!group && takesReadings(group, type);
  const wellWater = form.source === "borewell" || form.source === "open_well";
  const entered = Object.entries(form.values).filter(([, v]) => v.trim() !== "");
  const typeLabel = whatLabel(form);
  const takenAt = shots[0]?.meta.takenAt;
  const oldPhoto = takenAt && Date.now() - new Date(takenAt).getTime() > OLD_PHOTO_DAYS * 86_400_000 ? takenAt : null;
  // The What step's screen as shown: a screen whose earlier answer is missing falls back to that question.
  const shown: Screen = !form.seenAt ? "place" : screen === "water" && !home ? "what" : screen === "what" && home && !form.sourceAsked ? "water" : screen;

  // Why each screen cannot move on yet; null = ready.
  const outsideText = "This spot is outside the places we cover.";
  const blockers = [
    !shots.length ? "Add at least one photo." : here?.outside ? outsideText : null,
    whatBlocker(form),
    !coords ? "Place the pin on the map." : here?.outside ? outsideText : !here ? "Finding the place…" : null,
    // Known only once signed in, when the report started signed out.
    here?.outside ? outsideText : match && signedIn ? "Say whether it is the same one." : null,
  ];
  const reachable = (i: number) => blockers.slice(0, i).every((b) => b === null);
  // On the What step's first two screens, Next answers for that screen only and moves to the next one.
  const now =
    step !== 1 || shown === "what"
      ? blockers[step]
      : shown === "place"
        ? form.seenAt
          ? null
          : "Choose where you are."
        : form.sourceAsked
          ? null
          : "Choose which water.";

  const go = (i: number) => {
    moved.current = true;
    setStep(i);
    if ((top.current?.getBoundingClientRect().top ?? 0) < 0) top.current?.scrollIntoView({ block: "start" });
  };
  const next = () => {
    moved.current = true;
    if (step === 1 && shown === "place") return setScreen(home && !form.sourceAsked ? "water" : "what");
    if (step === 1 && shown === "water") return setScreen("what");
    go(step + 1);
  };
  const back = () => {
    moved.current = true;
    if (step === 1 && shown === "what") return setScreen(home ? "water" : "place");
    if (step === 1 && shown === "water") return setScreen("place");
    go(step - 1);
  };

  const formData = () => {
    const fd = new FormData();
    shots.forEach((s) => fd.append("photos", s.file));
    fd.append("lat", String(coords!.lat));
    fd.append("lng", String(coords!.lng));
    if (coords!.accuracy != null) fd.append("accuracy", String(coords!.accuracy));
    fd.append("category", group!);
    if (type && !isOther) fd.append("subcategory", type);
    if (form.note.trim()) fd.append("note", form.note.trim());
    if (form.seenAt) fd.append("seenAt", form.seenAt);
    if (form.extent && !home) fd.append("extent", form.extent);
    if (withGroup && sendGroups.some((g) => g.id === withGroup)) fd.append("groupId", withGroup);
    if (home && form.source) fd.append("waterSource", form.source);
    if (testing) {
      entered.forEach(([k, v]) => fd.append(`reading.${k}`, v.trim()));
      if (form.instrument) fd.append("test.instrument", form.instrument);
      if (form.filtered) fd.append("test.filtered", form.filtered);
      if (form.calibrated) fd.append("test.calibrated", form.calibrated);
      if (form.flushed && wellWater) fd.append("test.flushed", form.flushed);
      if (form.depth.trim() && wellWater) fd.append("test.depthFt", form.depth.trim());
      if (form.model.trim()) fd.append("test.model", form.model.trim());
    }
    const meta = shots[0]?.meta;
    if (meta?.takenAt) fd.append("takenAt", meta.takenAt);
    if (meta?.lat != null && meta.lng != null) {
      fd.append("photoLat", String(meta.lat));
      fd.append("photoLng", String(meta.lng));
    }
    return fd;
  };

  const finish = () => {
    moved.current = true;
    void clearDraft();
    top.current?.scrollIntoView({ block: "start" });
  };

  /** Offline or no answer: kept on the phone to send later. Never dropped: if it cannot be kept, the form stays as it is. */
  const keepForLater = async (fd: FormData) => {
    const kept = await enqueue(owner!, fd, typeLabel ?? "Report", here?.name ?? null);
    if (kept === "saved") {
      setQueued(true);
      return finish();
    }
    setError(
      kept === "full"
        ? `This phone already has ${OUTBOX_MAX} reports waiting to send. Send or remove some under My reports, then try again.`
        : "No connection. Please try again when you are back online.",
    );
  };

  const submit = async () => {
    if (!coords || !group || !owner) return;
    setBusy(true);
    setError(null);
    try {
      const fd = formData();
      if (navigator.onLine === false) return await keepForLater(fd);
      const res = await authFetch("/api/sightings", { method: "POST", body: fd }).catch(() => null);
      if (!res) return await keepForLater(fd);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setError(json.error ?? "Something went wrong. Please try again.");
      setSent(json.data);
      onSent();
      finish();
    } finally {
      setBusy(false);
    }
  };

  /** Keep the report on the phone, then go to Google; it is restored on return for the person to send. */
  const signInToSend = async () => {
    setSigning(true);
    let kept = false;
    try {
      const photos = await Promise.all(shots.map(async (s) => ({ file: await toStored(s.file), meta: s.meta })));
      kept = await saveDraft<Draft>({ v: 1, form, coords, pinFrom, withGroup, notSame, photos });
    } catch {
      // A photo could not be read back: treated as not kept.
    }
    if (!kept && !unkept) {
      setSigning(false);
      return setUnkept(true);
    }
    citizen.signIn();
  };

  /** "Yes, it's still there": the person's photo goes on the existing report as a still-there update, and a seen-it-too. */
  const addToIssue = async (m: NearbyIssue) => {
    if (!signedIn) return void signInToSend();
    setJoining(true);
    setJoinError(null);
    const post = async (event: "still_there" | "seen_too", photo?: File) => {
      const fd = new FormData();
      fd.append("event", event);
      if (photo) fd.append("photos", photo);
      const res = await authFetch(`/api/sightings/${m.reportId}/events`, { method: "POST", body: fd }).catch(() => null);
      const json = res ? await res.json().catch(() => ({})) : {};
      return { ok: !!res?.ok, status: res?.status ?? 0, error: res ? (json.error ?? "Could not add it. Please try again.") : "No connection. Please try again." };
    };
    // The still-there first, with the photo: a seen-it-too records its own still-there, which would use up the person's one update on this report today.
    const still = await post("still_there", shots[0]?.file);
    // Its own reporter cannot say "seen it too", and someone who updated it today already counts: neither stops the other.
    const seen = still.ok || still.status === 429 ? await post("seen_too") : null;
    setJoining(false);
    if (!still.ok && !seen?.ok) return setJoinError(seen && seen.status !== 403 ? seen.error : still.error);
    setJoined({ placeHref: m.issue.placeHref, photo: still.ok });
    finish();
  };

  /** Clears the report; "another one here" keeps the pin and the place choice and goes straight to the photo. */
  const reset = (sameSpot: boolean) => {
    shots.forEach((s) => URL.revokeObjectURL(s.url));
    setShots([]);
    setForm(sameSpot ? { ...EMPTY_FORM, seenAt: form.seenAt, source: form.source, sourceAsked: form.sourceAsked } : EMPTY_FORM);
    setScreen(sameSpot && form.seenAt ? "what" : "place");
    setAskAll(false);
    setHeld(sameSpot && !!coords);
    if (!sameSpot) {
      setCoords(null);
      setPinFrom(null);
      setPlace(null);
      setFocus(null);
      setNotSame([]);
    }
    setSearch("");
    setHits(null);
    setSuggested(null);
    closeList();
    setGeoError(null);
    setError(null);
    setJoinError(null);
    setSent(null);
    setQueued(false);
    setJoined(null);
    setRestored(false);
    setUnkept(false);
    go(0);
  };
  const startAgain = () => {
    void clearDraft();
    reset(false);
  };

  const again = (
    <div className="flex flex-wrap gap-3 pt-2">
      <button type="button" onClick={() => reset(true)} className={btn("primary")}>
        Report another one here
      </button>
      <button type="button" onClick={() => reset(false)} className={btn("secondary")}>
        Report something else
      </button>
    </div>
  );

  if (joined) {
    return (
      <div ref={top} className={`max-w-2xl scroll-mt-24 space-y-5 ${enter}`}>
        <CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <h2 ref={heading} tabIndex={-1} className={`${headingCls} text-2xl leading-tight focus:outline-none sm:text-3xl`}>
          Thank you, Neer Mitra.
        </h2>
        <p className={`max-w-[48ch] text-lg leading-relaxed ${muted}`}>
          {joined.photo
            ? "Added to the existing report. Your photo is checked before it shows."
            : "Added to the existing report. You had already updated it today, so your photo was not added."}
        </p>
        {joined.placeHref && (
          <p className="text-lg">
            <Link href={joined.placeHref} className={link}>
              See it on its place page
            </Link>
          </p>
        )}
        {again}
      </div>
    );
  }

  if (queued) {
    return (
      <div ref={top} className={`max-w-2xl scroll-mt-24 space-y-5 ${enter}`}>
        <h2 ref={heading} tabIndex={-1} className={`${headingCls} text-2xl leading-tight focus:outline-none sm:text-3xl`}>
          Saved on this phone.
        </h2>
        <p className={`max-w-[48ch] text-lg leading-relaxed ${muted}`}>
          It will send when you are back online. Until then it waits under My reports, where you can send it now or remove it.
        </p>
        {again}
        <button type="button" onClick={onOpenMine} className={btn("quiet")}>
          Go to My reports
        </button>
      </div>
    );
  }

  if (sent) {
    const routed = sent.handler || (sent.role && sent.national.length > 0);
    return (
      <div ref={top} className={`grid scroll-mt-24 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-20 ${enter}`}>
        <div className="space-y-5">
          <CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <h2 ref={heading} tabIndex={-1} className={`${headingCls} text-2xl leading-tight focus:outline-none sm:text-3xl`}>
            Thank you, Neer Mitra. Your report is in.
          </h2>
          <p className={`max-w-[48ch] text-lg leading-relaxed ${muted}`}>
            We check every report before it appears on the {sent.placeName} pages, usually within {REVIEW_WITHIN_DAYS} days. Follow it, and
            keep its status up to date, under My reports.
          </p>
          {sent.placeHref && sent.placeLabel && (
            <p className={`max-w-[48ch] text-lg leading-relaxed ${muted}`}>
              Once checked, it appears {sent.placeHref.includes("layer=reports") ? "on the map" : "in the list"} for{" "}
              <Link href={sent.placeHref} className={link}>
                {sent.placeLabel}
              </Link>
              .
            </p>
          )}
          {sent.readings.length > 0 && (
            <Readings
              readings={sent.readings}
              test={
                form.instrument && form.filtered
                  ? testLabel({ instrument: form.instrument, filtered: form.filtered }, WATER_SOURCES.find((w) => w.key === form.source)?.label ?? null)
                  : null
              }
            />
          )}
          {routed && <ReminderLink />}
          <NotifyToggle authFetch={authFetch} />
          {again}
          <button type="button" onClick={onOpenMine} className={btn("quiet")}>
            Go to My reports
          </button>
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
            Take a photo
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void pick(e.target.files, "camera"); e.target.value = ""; }} />
          </label>
          <label className={`${btn("secondary", "xl")} ${fileFocus} w-full pointer-fine:hidden`}>
            {addInput}{" "}
            Choose from gallery
          </label>
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
          {held && coords && <p className={`text-sm ${muted}`}>Same spot as your last report. You can move the pin on the map.</p>}
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
                setHeld(false);
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

  const whatStep = (
    <WhatStep
      form={form}
      patch={patch}
      screen={shown}
      onScreen={(s) => {
        moved.current = true;
        setScreen(s);
      }}
      nearby={here?.nearby ?? null}
      askAll={askAll}
      onAskAll={() => setAskAll(true)}
    />
  );

  const whereStep = (
    <>
      <form onSubmit={findPlace} role="search" className="space-y-2">
        <div className="relative flex gap-2">
          <input
            ref={searchBox}
            type="search"
            role="combobox"
            aria-expanded={panelOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={panelOpen && active >= 0 && active < optionCount ? `${listId}-${active}` : undefined}
            autoComplete="off"
            enterKeyHint="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setListOpen(true);
              setActive(-1);
              setHits(null);
              setSearchError(null);
            }}
            onFocus={warm}
            onBlur={closeList}
            onKeyDown={onSearchKey}
            placeholder="Lake, ward, village or street"
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
          {/* Pressing in the list keeps focus in the box, so a tap picks before the box closes the list. */}
          <div
            hidden={!panelOpen}
            onMouseDown={(e) => e.preventDefault()}
            className={`absolute inset-x-0 top-full z-20 mt-1 max-h-[min(22rem,55vh)] overflow-y-auto overscroll-contain rounded-lg border bg-white shadow-lg dark:bg-slate-900 ${rule}`}
          >
            {!answer && !placeRows.length && <p className={`px-3 py-2.5 text-sm ${muted}`}>Looking for covered places…</p>}
            {answer && !answer.failed && !answer.list.length && <p className={`px-3 py-2.5 text-sm ${muted}`}>{NO_PLACE}</p>}
            <ul id={listId} role="listbox" aria-label="Places we cover" className={`divide-y ${rule}`}>
              {placeRows.map((s, i) => (
                <li
                  key={`${s.kind}:${s.label}:${s.lat},${s.lng}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onClick={() => choose(i)}
                  className={`${OPTION} text-slate-900 dark:text-slate-100`}
                >
                  <span className="min-w-0">{s.label}</span>
                  <span className={`shrink-0 text-xs ${muted}`}>{KIND_WORD[s.kind]}</span>
                </li>
              ))}
              {addressRow && (
                <li
                  id={`${listId}-${placeRows.length}`}
                  role="option"
                  aria-selected={active === placeRows.length}
                  onClick={() => choose(placeRows.length)}
                  className={`${OPTION} font-semibold text-cyan-800 dark:text-cyan-400`}
                >
                  Search for a street or address
                </li>
              )}
            </ul>
          </div>
        </div>
        <p aria-live="polite" className="sr-only">
          {panelOpen && answer && !answer.failed ? (answer.list.length ? `${answer.list.length} ${answer.list.length === 1 ? "place" : "places"} found` : NO_PLACE) : ""}
        </p>
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
            setHeld(false);
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
      {(home || group === "drinking") && <p className={`text-sm ${muted}`}>Shown publicly at ward or village level only, never this point.</p>}
    </>
  );

  const sourceLabel = home ? WATER_SOURCES.find((w) => w.key === form.source)?.label : null;
  const extentLabel = !home && form.extent ? EXTENTS.find((x) => x.key === form.extent)?.label : null;
  const rows: [string, React.ReactNode][] = [
    ["What", typeLabel && <span className="line-clamp-2">{typeLabel}</span>],
    ["Where", here?.name ?? (coords ? "Pin placed" : null)],
    ...(form.seenAt && !home ? [["Seen at", seenAtLabel(form.seenAt)] as [string, string | null]] : []),
    ...(extentLabel ? [["How much", extentLabel] as [string, string]] : []),
    ...(sourceLabel ? [["Water from", sourceLabel] as [string, string]] : []),
    ...(testing && entered.length
      ? [["Results", entered.map(([k, v]) => `${PARAMETERS.find((p) => p.key === k)?.name} ${v}`).join(", ")] as [string, string]]
      : []),
    ...(testing && form.instrument
      ? [
          [
            "Tested with",
            [TEST_INSTRUMENTS.find((t) => t.key === form.instrument)?.label, form.filtered === "filtered" ? "after a filter" : null].filter(Boolean).join(", "),
          ] as [string, string],
        ]
      : []),
  ];
  /** The report as it stands: a large photo beside the steps on wide screens, a thumbnail row on the phone's last step. */
  const summary = (compact: boolean) => (
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
      {restored && (
        <div role="status" className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900 ${enter}`}>
          <span className="text-slate-800 dark:text-slate-200">
            {signedIn ? "Your report is as you left it. Check it, then tap Send report." : "Your report is as you left it."}
          </span>
          <button type="button" onClick={startAgain} className={`${link} text-sm`}>
            Start again
          </button>
        </div>
      )}
      {match && (
        <SameIssueCard
          match={match}
          signedIn={signedIn}
          busy={joining || signing}
          error={joinError}
          onYes={() => void addToIssue(match)}
          onNo={() => setNotSame((n) => [...n, match.issue.id])}
        />
      )}
      <div className="lg:hidden">{summary(true)}</div>
      {sendGroups.length > 0 && (
        <Choice
          legend="Send with"
          hint="With a group, the report shows the group's name, never yours."
          options={[{ key: "", label: "Just me" }, ...sendGroups.map((g) => ({ key: g.id, label: g.name }))]}
          value={withGroup ?? ""}
          onChange={(k) => setWithGroup(k || null)}
        />
      )}
      {!isOther && (
        <label className="block">
          <span className="font-medium text-slate-900 dark:text-slate-100">Anything our reviewer should know?</span>
          <span className={`block text-sm ${muted}`}>Optional. Never published.</span>
          <textarea value={form.note} onChange={(e) => patch({ note: e.target.value.slice(0, LIMITS.noteChars) })} rows={3} className={`${field} mt-2`} />
        </label>
      )}
      {signedIn ? (
        <p className={`flex items-start gap-2 text-sm ${muted}`}>
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Your name and email never appear with this report.{" "}
            <a href="#privacy" className={link}>
              How we protect you
            </a>
          </span>
        </p>
      ) : (
        <div className={`space-y-2 border-t pt-5 ${rule}`}>
          <p className="font-semibold text-slate-900 dark:text-slate-100">Last step: sign in to send</p>
          <p className={`max-w-[60ch] text-sm leading-relaxed ${muted}`}>
            We ask everyone who sends a report to sign in once, so one person cannot flood the record. Your report stays on this phone while
            you sign in, and you send it when you are back. Your name and email never appear with it.{" "}
            <a href="#privacy" className={link}>
              How we protect you
            </a>
          </p>
          {unkept && (
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              This browser would not keep your report while you sign in, so you would add it again afterwards. Tap Continue with Google to sign in
              anyway.
            </p>
          )}
        </div>
      )}
      <Problem text={error} />
    </>
  );

  const whatHead = whatHeading(shown, form);
  const title = step === 1 ? whatHead.title : TITLES[step];
  const subtitle = [
    "Of the problem itself, at the spot, with no faces, vehicle number plates or house names or numbers (you can blur them). For a water test, photograph the meter or kit showing the reading.",
    whatHead.subtitle,
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

        <div key={step === 1 ? `1-${shown}` : step} className={`mt-9 space-y-6 ${enter}`}>
          <div>
            <h2 ref={heading} tabIndex={-1} className={`${headingCls} text-2xl leading-tight focus:outline-none sm:text-3xl`}>
              {title}
            </h2>
            {subtitle && <p className={`mt-2 max-w-[60ch] ${muted}`}>{subtitle}</p>}
          </div>
          {[photoStep, whatStep, whereStep, sendStep][step]}
        </div>

        <div
          className={`sticky bottom-0 z-10 -mx-4 mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mt-10 sm:flex-nowrap sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none ${rule}`}
        >
          {now && <p className={`w-full text-sm sm:hidden ${muted}`}>{now}</p>}
          {step > 0 && (
            <button type="button" onClick={back} className={btn("quiet", "lg")}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
          )}
          <p className={`ml-auto hidden text-sm sm:block ${muted}`} aria-live="polite">
            {now}
          </p>
          {step < 3 ? (
            <button type="button" disabled={!!now} onClick={next} className={`${btn("primary")} ml-auto min-w-32 sm:ml-0`}>
              Next
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : signedIn ? (
            <ActionButton label="Send report" busyLabel="Sending…" busy={busy} disabled={!!blockers[3]} onClick={submit} className={`${btn("primary")} ml-auto min-w-40 sm:ml-0`} />
          ) : (
            <GoogleButton onClick={() => void signInToSend()} busy={signing} size="md" className="ml-auto sm:ml-0" />
          )}
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24">{summary(false)}</div>
      </aside>
    </div>
  );
}

