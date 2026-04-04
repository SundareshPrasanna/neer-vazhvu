import { Suspense } from "react";
import type { Metadata } from "next";
import { WardReportCard } from "@/components/my-ward/ward-report-card";
import { loadProfilesServer } from "@/lib/utils/load-profiles-server";
import { computeWardRankings } from "@/lib/utils/ward-rankings";

interface Props {
  searchParams: Promise<{ ward?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const wardNumber = params.ward ? parseInt(params.ward, 10) : null;

  if (!wardNumber || isNaN(wardNumber)) {
    return { title: "Ward Report Card | Neer Vazhvu" };
  }

  const profiles = loadProfilesServer();
  const rankings = computeWardRankings(wardNumber, profiles);

  if (!rankings) {
    return { title: `Ward ${wardNumber} | Neer Vazhvu` };
  }

  const title = `Ward ${wardNumber} - ${rankings.zoneName} Report Card | Neer Vazhvu`;
  const description = `Grade ${rankings.overallGrade} - Ranked #${rankings.overallRank} of ${rankings.overallTotal}. Water body health, flood risk, drainage & sewerage report card.`;
  const ogImage = `/api/og/ward?ward=${wardNumber}`;

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
          Loading report...
        </div>
      }
    >
      <WardReportCard />
    </Suspense>
  );
}
