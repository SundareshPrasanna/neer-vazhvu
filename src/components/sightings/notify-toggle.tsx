"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Check } from "lucide-react";

import { ActionButton, useFlash } from "./action-feedback";
import { enter, link, muted } from "./ui";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
type Mode = "unsupported" | "ios" | "blocked" | "off" | "on";

const SW = "/citizen-sw.js";
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const JSON_HEADERS = { "Content-Type": "application/json" };

const keyBytes = (b64: string) =>
  Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

/** What this browser can do, before asking for anything. */
function detect(): Mode {
  if (!VAPID) return "unsupported";
  const ua = navigator.userAgent;
  const apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // iPhone and iPad allow notifications only from a site added to the home screen.
  if (apple && !installed) return "ios";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return Notification.permission === "denied" ? "blocked" : "off";
}

const subscription = async () => (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription() ?? null;

/** Stops notices on this browser: on sign-out, so a shared phone does not keep getting them. */
export async function stopNotices(authFetch: Fetch) {
  if (!("serviceWorker" in navigator)) return;
  const sub = await subscription().catch(() => null);
  if (!sub) return;
  await authFetch("/api/sightings/push", { method: "DELETE", headers: JSON_HEADERS, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => null);
  await sub.unsubscribe().catch(() => false);
}

/** Opt-in notices on this device when one of the reporter's reports changes. Permission is asked only on tap. */
export function NotifyToggle({ authFetch }: { authFetch: Fetch }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, flash] = useFlash<string>();

  useEffect(() => {
    let live = true;
    const found = detect();
    (found === "off" ? subscription() : Promise.resolve(null))
      .then(async (sub) => {
        if (sub && Notification.permission === "granted") {
          // Re-saved on each visit: the server may have dropped it (account deleted, a sixth device).
          await authFetch("/api/sightings/push", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(sub) }).catch(() => null);
          if (live) setMode("on");
        } else if (live) setMode(found);
      })
      .catch(() => live && setMode(found));
    return () => {
      live = false;
    };
  }, [authFetch]);

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setMode(permission === "denied" ? "blocked" : "off");
      await navigator.serviceWorker.register(SW);
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID!) }));
      const res = await authFetch("/api/sightings/push", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(sub) });
      if (!res.ok) {
        await sub.unsubscribe().catch(() => false);
        throw new Error();
      }
      setMode("on");
    } catch {
      setError("Could not turn notifications on. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setError(null);
    try {
      await stopNotices(authFetch);
      setMode("off");
      flash("Notifications off");
    } catch {
      setError("Could not turn notifications off. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!mode || mode === "unsupported") return null;
  const note = `flex items-start gap-2 text-sm ${muted}`;
  if (mode === "ios") {
    return (
      <p className={note}>
        <Bell className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        On iPhone, add this site to your home screen to get notifications.
      </p>
    );
  }
  if (mode === "blocked") {
    return (
      <p className={note}>
        <Bell className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Notifications are blocked for this site. To get them, allow them in your browser settings.
      </p>
    );
  }
  const quiet = `inline-flex items-center gap-1.5 text-left text-sm ${link} disabled:opacity-45`;
  return (
    <div className="space-y-1.5">
      {mode === "on" ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
            <BellRing className="h-4 w-4 shrink-0" aria-hidden="true" />
            Notifications are on for this device
          </span>
          <ActionButton label="Turn off" busyLabel="Turning off…" busy={busy} onClick={turnOff} className={quiet} />
        </p>
      ) : (
        <>
          <ActionButton
            label="Tell me when something changes"
            busyLabel="Turning on…"
            busy={busy}
            onClick={turnOn}
            icon={<Bell className="h-4 w-4 shrink-0" aria-hidden="true" />}
            className={quiet}
          />
          <p className={`text-sm ${muted}`}>Only on this device. It carries nothing about you, and you can turn it off at any time.</p>
        </>
      )}
      {saved && (
        <p role="status" className={`inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400 ${enter}`}>
          <Check className="h-4 w-4" aria-hidden="true" />
          {saved}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
