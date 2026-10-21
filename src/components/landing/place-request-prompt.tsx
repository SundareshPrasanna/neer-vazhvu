"use client";

import { useState } from "react";
import { RequestForm, requestsEnabled } from "@/components/requests/request-form";
import { CONTACT_EMAIL, contactGmail, contactMailto } from "@/lib/contact";

/**
 * What the place search shows when nothing on the board is the place the
 * visitor typed: a way to ask for it. The signed-in request form when
 * sign-in is on; email otherwise, and as the form's fallback.
 */
export function PlaceRequestPrompt({ query, afterNear }: { query: string; afterNear: boolean }) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-5 sm:p-6">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {afterNear ? "Not the place you meant?" : `We don’t cover “${query}” yet.`}
      </h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        Ask for it. We read every request, and add places as their public data
        and the number of people asking allow.
      </p>
      <div className="mt-4">
        {requestsEnabled ? <RequestForm subject={query} /> : null}
        <EmailRequest query={query} primary={!requestsEnabled} />
      </div>
    </div>
  );
}

/**
 * A mailto link opens nothing on a machine with no mail app or a browser
 * with no mail handler, and the page cannot tell. So the click always
 * reveals the other ways to send the same message.
 */
function EmailRequest({ query, primary }: { query: string; primary: boolean }) {
  const [clicked, setClicked] = useState(false);
  const [copied, setCopied] = useState(false);
  const subject = `Place request: ${query}`;
  const body = `Please add ${query} to Neer Vazhvu.\n\nWhy it matters to me:\n\nAny data sources I know of:\n`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`To: ${CONTACT_EMAIL}\nSubject: ${subject}\n\n${body}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const secondary =
    "inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500";

  return (
    <>
      {primary ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href={contactMailto(subject, body)}
            onClick={() => setClicked(true)}
            className="inline-flex items-center justify-center rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-800 dark:hover:bg-cyan-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            Request {query}
          </a>
          <span className="text-sm text-slate-500 dark:text-slate-400">or write to {CONTACT_EMAIL}</span>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Prefer email?{" "}
          <a
            href={contactMailto(subject, body)}
            onClick={() => setClicked(true)}
            className="font-medium text-cyan-700 dark:text-cyan-400 underline-offset-2 hover:underline"
          >
            Send it to {CONTACT_EMAIL}
          </a>
        </p>
      )}
      {clicked && (
        <div className="mt-4 border-t border-slate-200 dark:border-slate-800 pt-4" role="status">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Mail app didn&apos;t open? Send the same request another way.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={copy} className={secondary}>
              {copied ? "Copied" : "Copy request"}
            </button>
            <a href={contactGmail(subject, body)} target="_blank" rel="noopener noreferrer" className={secondary}>
              Open in Gmail
            </a>
          </div>
        </div>
      )}
    </>
  );
}
