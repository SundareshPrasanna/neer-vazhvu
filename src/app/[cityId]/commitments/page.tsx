import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import CommitmentsClient from "./commitments-client";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config || !config.hasCommitments) return { title: "Water Commitments | Neer Vazhvu" };

  const title = `${config.displayName} Water Commitments | Neer Vazhvu`;
  const description = `Dated water commitments by ${config.displayName}'s institutions - to residents, courts and funders - followed from announcement to delivery. Every status carries its citation; the history is kept, never overwritten.`;
  return {
    title,
    description,
    alternates: { canonical: `/${cityId}/commitments` },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "en_IN",
      siteName: "Neer Vazhvu",
      url: `https://neervazhvu.org/${cityId}/commitments`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CommitmentsPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config || !config.hasCommitments) notFound();
  return <CommitmentsClient cityId={cityId} />;
}
