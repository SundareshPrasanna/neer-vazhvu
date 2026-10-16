"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const signInConfigured = !!(URL_ && KEY);

/** Browser auth only; the session's token goes to our API, never to tables. */
function browserClient(): SupabaseClient {
  client ??= createClient(URL_!, KEY!, {
    auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, storageKey: "nv-citizen-auth" },
  });
  return client;
}

export function useCitizen() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!signInConfigured);

  useEffect(() => {
    if (!signInConfigured) return;
    const auth = browserClient().auth;
    auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(() => {
    void browserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/for-citizens` },
    });
  }, []);

  const signOut = useCallback(() => void browserClient().auth.signOut(), []);

  /** fetch with the user's (refreshed) token. */
  const authFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const { data } = await browserClient().auth.getSession();
    const headers = new Headers(init.headers);
    if (data.session) headers.set("Authorization", `Bearer ${data.session.access_token}`);
    return fetch(url, { ...init, headers });
  }, []);

  return { session, ready, signIn, signOut, authFetch };
}

/** Date and GPS from the original photo; resizing strips them. A hint for the reviewer, not proof. */
export async function readPhotoMeta(file: File): Promise<{ takenAt: string | null; lat: number | null; lng: number | null }> {
  try {
    const exifr = (await import("exifr")).default;
    const t = await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"] });
    const when = t?.DateTimeOriginal ?? t?.CreateDate;
    return {
      takenAt: when instanceof Date && !Number.isNaN(when.getTime()) ? when.toISOString() : null,
      lat: typeof t?.latitude === "number" ? t.latitude : null,
      lng: typeof t?.longitude === "number" ? t.longitude : null,
    };
  } catch {
    return { takenAt: null, lat: null, lng: null };
  }
}

/** Resize on the phone before upload: ~0.3-0.6 MB JPEG, under the server's cap. */
export async function shrinkPhoto(file: File, max = 1600): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}
