"use client";

import { Check, MessageCircle, Share2 } from "lucide-react";

import { useFlash } from "./action-feedback";
import { btn } from "./ui";

const TEXT = "Report trash, sewage or unsafe water near you, privately, on Neer Vazhvu. Here is how it works:";

/** Share the guide: the phone's share sheet, WhatsApp, or a copied link. */
export function ShareGuide() {
  const [copied, flash] = useFlash<true>(2500);
  const share = async () => {
    const url = `${window.location.origin}/for-citizens#how-it-works`;
    if (navigator.share) return navigator.share({ title: "Neer Vazhvu: for citizens", text: TEXT, url }).catch(() => {});
    await navigator.clipboard?.writeText(url).catch(() => {});
    flash(true);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={share} className={btn("secondary", "md")}>
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
        {copied ? "Link copied" : "Share this page"}
      </button>
      <a
        className={btn("secondary", "md")}
        target="_blank"
        rel="noopener noreferrer"
        href={`https://wa.me/?text=${encodeURIComponent(`${TEXT} https://neervazhvu.org/for-citizens#how-it-works`)}`}
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        Send on WhatsApp
      </a>
    </div>
  );
}
