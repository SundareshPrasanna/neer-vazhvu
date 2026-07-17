import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { tryGetBasinManifest, type BasinFloor, type BasinInventory } from "@/lib/basins";
import { tryGetPlaceConfig } from "@/lib/cities";
import { BasinAtlasClient } from "@/components/basin/basin-atlas-client";

// Chrome-less basin atlas for third-party embedding (e.g. the Arkavathi deep
// dive on paani.earth). The site Header/Footer suppress themselves on /embed,
// and next.config.ts relaxes frame-ancestors for this namespace ONLY - the
// rest of the site stays unframeable. Generic over the basin registry: a new
// basin is embeddable the moment its manifest + data exist (data-only add).
//
// Embedder snippet (allow="geolocation" is needed for the "Where am I?"
// control - without it the browser silently denies inside an iframe):
//   <iframe src="https://neervazhvu.org/embed/basins/arkavathi"
//           style="width:100%;height:80vh;border:0" allow="geolocation"
//           title="Arkavathi Basin Atlas - Neer Vazhvu x Paani Earth"></iframe>

const FLOORS: BasinFloor[] = ["hydrology", "monitoring", "pressures", "governance"];

function loadBasinInventory(basinId: string): BasinInventory | null {
  const fp = path.join(process.cwd(), "public", "data", "basins", basinId, "inventory.json");
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as BasinInventory;
  } catch {
    return null;
  }
}

interface PageProps {
  params: Promise<{ basinId: string }>;
  searchParams: Promise<{ river?: string; floor?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { basinId } = await params;
  const manifest = tryGetBasinManifest(basinId);
  return {
    title: manifest ? `${manifest.displayName} Atlas (embed) | Neer Vazhvu` : "Basin atlas embed | Neer Vazhvu",
    // Embeds are a distribution surface, not a search surface - the canonical
    // content lives on the city rivers page.
    robots: { index: false, follow: false },
  };
}

export default async function BasinEmbedPage({ params, searchParams }: PageProps) {
  const { basinId } = await params;
  const sp = await searchParams;
  const manifest = tryGetBasinManifest(basinId);
  if (!manifest) notFound();

  const cityId = manifest.cityIds[0];
  const city = tryGetPlaceConfig(cityId);
  const inventory = loadBasinInventory(basinId);
  const initialRiverId = manifest.rivers.some((r) => r.riverId === sp.river) ? sp.river! : null;
  const initialFloor = FLOORS.includes(sp.floor as BasinFloor) ? (sp.floor as BasinFloor) : undefined;

  return (
    <div className="fixed inset-0 flex flex-col bg-white dark:bg-slate-950">
      {/* Compact credit bar: attribution + the route back to the full site.
          target=_blank because inside an iframe an in-frame navigation would
          trap the reader in the embed. */}
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0 text-[12px]">
        <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
          {manifest.displayName} Atlas
          <span className="font-normal text-slate-400"> - Neer Vazhvu x Paani Earth Foundation</span>
        </span>
        <a
          href={`https://neervazhvu.org/${cityId}/rivers`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          Open on neervazhvu.org &#8599;
        </a>
      </div>
      <div className="relative flex-1 min-h-0">
        <BasinAtlasClient
          cityId={cityId}
          cityDisplayName={city?.displayName ?? cityId}
          manifest={manifest}
          inventory={inventory}
          initialRiverId={initialRiverId}
          initialFloor={initialFloor}
          embedded
        />
      </div>
    </div>
  );
}
