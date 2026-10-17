import "server-only";

import { WebPushError, sendNotification } from "web-push";

import { logRouteError } from "@/lib/api-error";
import { adminClient, reportsEnabled } from "./auth";

export interface Notice {
  title: string;
  body: string;
  /** Path on this site to open when the notice is tapped. */
  url?: string;
}

const DEFAULT_SUBJECT = "mailto:contact@neervazhvu.org";
/** A notice nobody's browser picked up in three days is stale; the push service may drop it. */
const TTL_SECONDS = 3 * 86_400;

/** Sends a notice to every browser the reporter turned notifications on in; returns how many took it. Never throws. */
export async function sendNotice(reporterKey: string, notice: Notice): Promise<number> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey || !reportsEnabled()) return 0;
  try {
    const admin = adminClient();
    const { data, error } = await admin.from("sighting_push_subscriptions").select("endpoint, p256dh, auth").eq("reporter_key", reporterKey);
    if (error) throw error;
    const options = { vapidDetails: { subject: process.env.VAPID_SUBJECT || DEFAULT_SUBJECT, publicKey, privateKey }, TTL: TTL_SECONDS, timeout: 10_000 };
    const payload = JSON.stringify({ title: notice.title, body: notice.body, url: notice.url ?? "/for-citizens" });
    const gone: string[] = [];
    const sent = await Promise.all(
      ((data ?? []) as { endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
        try {
          await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, options);
          return 1;
        } catch (err) {
          // 404 and 410: the browser unsubscribed or the subscription expired.
          if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) gone.push(s.endpoint);
          // Status or error code only: an endpoint identifies a browser.
          else logRouteError("sightings/notify", `push failed: ${err instanceof WebPushError ? err.statusCode : ((err as { code?: string })?.code ?? "error")}`);
          return 0;
        }
      }),
    );
    if (gone.length) await admin.from("sighting_push_subscriptions").delete().in("endpoint", gone);
    return sent.reduce<number>((a, b) => a + b, 0);
  } catch (err) {
    logRouteError("sightings/notify", err);
    return 0;
  }
}

/**
 * Tell a reporter, on every browser they turned notifications on in, that something changed on their reports.
 * Never throws: a failed notice must not fail the update that caused it.
 */
export async function notifyReporter(reporterKey: string, notice: Notice): Promise<void> {
  await sendNotice(reporterKey, notice);
}
