"use client";

import { useState } from "react";

const TEXT = "Report trash, sewage or unsafe water near you, privately, on Neer Vazhvu. Here is how it works:";

/** Share the guide: the phone's share sheet, WhatsApp, or a copied link. */
export function ShareGuide() {
  const [copied, setCopied] = useState(false);
  const url = () => `${window.location.origin}/for-citizens#how-it-works`;
  const share = async () => {
    if (navigator.share) return navigator.share({ title: "Neer Vazhvu: for citizens", text: TEXT, url: url() }).catch(() => {});
    await navigator.clipboard?.writeText(url()).catch(() => {});
    setCopied(true);
  };
  const button = "rounded-lg border border-cyan-700 px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" onClick={share} className={button}>
        {copied ? "Link copied" : "Share this guide"}
      </button>
      <a
        className={button}
        target="_blank"
        rel="noopener noreferrer"
        href={`https://wa.me/?text=${encodeURIComponent(`${TEXT} https://neervazhvu.org/for-citizens#how-it-works`)}`}
      >
        Send on WhatsApp
      </a>
    </div>
  );
}
