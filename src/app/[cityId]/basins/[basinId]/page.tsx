import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { tryGetPlaceConfig } from "@/lib/cities";
import { tryGetBasinManifest, type BasinInventory } from "@/lib/basins";
import { BasinAtlasClient } from "./basin-atlas-client";

interface PageProps {
  params: Promise<{ cityId: string; basinId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId, basinId } = await params;
  const manifest = tryGetBasinManifest(basinId);
  if (!manifest) return { title: "Basin atlas | Neer Vazhvu" };
  return {
    title: `${manifest.displayName} | Neer Vazhvu`,
    description: manifest.blurb,
    alternates: { canonical: `/${cityId}/basins/${basinId}` },
  };
}

function loadInventory(basinId: string): BasinInventory | null {
  const fp = path.join(process.cwd(), "public", "data", "basins", basinId, "inventory.json");
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as BasinInventory;
  } catch {
    return null;
  }
}

export default async function BasinAtlasPage({ params }: PageProps) {
  const { cityId, basinId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  const manifest = tryGetBasinManifest(basinId);
  // Guard: the basin must exist AND be hosted by this city.
  if (!manifest || !(config.basinIds ?? []).includes(basinId)) notFound();

  const inventory = loadInventory(basinId);

  return (
    <BasinAtlasClient
      cityId={cityId}
      cityDisplayName={config.displayName}
      manifest={manifest}
      inventory={inventory}
    />
  );
}
