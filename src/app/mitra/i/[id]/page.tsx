import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { day } from "@/components/sightings/report-card";
import { appLink, muted } from "@/components/sightings/ui";
import { countsLine, issueHref, shareDescription, sharePath, shareTitle } from "@/lib/sightings/issue-share";
import { loadSharedIssue } from "./load";

/** Counts move slowly; a link passed round a group is read from the cache. */
export const revalidate = 300;

type Props = { params: Promise<{ id: string }> };

/** The tags a link preview reads (WhatsApp, X, LinkedIn); the image is ./opengraph-image.tsx. Not for search results. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const shared = await loadSharedIssue(id);
  if (!shared) notFound();
  const title = shareTitle(shared.issue, shared.placeName);
  const description = shareDescription(shared.issue, day);
  return {
    title: `${title} | Neer Vazhvu`,
    description,
    robots: { index: false, follow: true },
    openGraph: { title, description, type: "article", siteName: "Neer Vazhvu", locale: "en_IN", url: sharePath(id) },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * A shared issue's link: answers with its preview tags, then sends a browser straight on to the place page with the
 * issue open. Link previews run no script, so they stay here and read the tags. Not found, unpublished or a home
 * report: 404.
 */
export default async function SharedIssuePage({ params }: Props) {
  const { id } = await params;
  const shared = await loadSharedIssue(id);
  if (!shared) notFound();
  const href = issueHref(shared.issue.placeHref, shared.issue.id);
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <script dangerouslySetInnerHTML={{ __html: `location.replace(${JSON.stringify(href).replace(/</g, "\\u003c")})` }} />
      <p className="text-slate-900 dark:text-slate-100">
        {shareTitle(shared.issue, shared.placeName)}. <span className={muted}>{countsLine(shared.issue, day)}</span>{" "}
        <Link href={href} className={appLink}>
          Open it on Neer Vazhvu
        </Link>
      </p>
    </main>
  );
}
