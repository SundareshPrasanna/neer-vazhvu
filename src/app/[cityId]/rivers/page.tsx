import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { isFeatureSupportedForCity } from "@/lib/cities/routing";
import { basinsForCity, tryGetBasinManifest } from "@/lib/basins";
import { loadBasinInventory } from "@/lib/basins/data";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";
import { riversVariant } from "@/lib/cities/data-paths";
import RiversClient from "./rivers-client";
import { RIVERS_CONTENT } from "@/content/rivers";
import ChennaiRiversClient from "./chennai-rivers-client";

interface PageProps {
  params: Promise<{ cityId: string }>;
}


export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Rivers | Neer Vazhvu" };
  return {
    title: `${config.displayName} Rivers | Neer Vazhvu`,
    description:
      RIVERS_CONTENT[config.cityId]?.metaDescription ??
      `River-system map for ${config.displayName} - mainstem rivers, tributaries, and pollution status from official monitoring.`,
    alternates: { canonical: `/${cityId}/rivers` },
  };
}



export default async function CityRiversPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  // Cities whose FEATURE_AVAILABILITY set omits "rivers" 404 here, the same
  // gate my-ward uses. Without it this page fell through to the generic
  // not-yet-available state, which tells the reader the page "hasn't shipped
  // yet" and lists what is needed to ship it - true for a city awaiting a
  // data layer, FALSE for one that has no river at all. Gurugram is the
  // first: its NWMP stations are all lakes and borewells, and its surface
  // water leaves as drain flow into the Najafgarh jheel. Promising a page
  // that can never exist is the same defect as Delhi's storage chart
  // promising to "fill in automatically" for a city that impounds nothing.
  if (!isFeatureSupportedForCity("/rivers", cityId)) notFound();

  // Renderer is selected by declared data-layout variant, not a city-id
  // branch in render code (see multi-city-component-discipline.md rule 3).
  // Chennai's legacy combined-rivers data layout (CPCB stations + industrial
  // pollution + Cooum sewage inlets + ward search) maps to the richer
  // ChennaiRiversClient; every other city uses the shared RiversClient.
  if (riversVariant(cityId) === "chennai-combined") {
    // Chennai's combined map self-fits to its rivers; centre on the city.
    // Hand down the basin (if any) so the treatment-&-waste gaps atlas can be
    // opened from this richer surface too - same additive wiring as the shared
    // client below, threaded into the Chennai-specific variant.
    const chennaiBasin = basinsForCity(cityId)[0] ?? null;
    return (
      <ChennaiRiversClient
        cityId={cityId}
        cityDisplayName={config.displayName}
        mapCenter={[config.center.lat, config.center.lng]}
        mapZoom={11}
        basin={
          chennaiBasin
            ? { manifest: chennaiBasin, inventory: loadBasinInventory(chennaiBasin.basinId) }
            : null
        }
      />
    );
  }

  const content = RIVERS_CONTENT[config.cityId];
  const riverInfo = content?.riverInfo;
  if (!riverInfo) {
    return (
      <FeatureNotYetAvailable
        config={config}
        feature="Rivers"
        scope="basin-system"
        routeKey="rivers"
        whatItShowsForChennai="3 rivers (Cooum, Adyar, Kosasthalaiyar) with CPCB NWMP annual quality samples, sewage inlets, pollution overlays from industrial sources"
        dataGapNote="No curated river-info config for this city yet."
        relatedLinks={[
          { href: `/${cityId}`, label: `${config.displayName} home` },
          { href: `/${cityId}/water-bodies`, label: "Water bodies map" },
        ]}
      />
    );
  }

  // Default framing nudges south-west of the city centre (the Vaigai mainstem
  // runs Theni -> Madurai -> Ramanathapuram); a city can set its own.
  const mapCenter: [number, number] =
    content?.map?.center ?? [config.center.lat - 0.1, config.center.lng - 0.2];
  const mapZoom = content?.map?.zoom ?? 9;
  const header = content?.header ?? { scopeLabel: "Basin system" };

  // Additive: if a river on this page has a deep basin atlas, hand it down so
  // clicking that river can open the layered basin view. The standard rivers
  // map is unchanged for everyone else.
  const basin = basinsForCity(cityId)[0] ?? null;
  const basinProp = basin
    ? { manifest: basin, inventory: loadBasinInventory(basin.basinId) }
    : null;
  // Optional parent-basin overview entry (e.g. Bengaluru -> Cauvery KA).
  const overviewManifest = header.overviewBasinId ? tryGetBasinManifest(header.overviewBasinId) : null;
  const overviewBasinProp = overviewManifest
    ? { manifest: overviewManifest, inventory: loadBasinInventory(overviewManifest.basinId) }
    : null;

  return (
    <RiversClient
      hasTreatmentDischarge={config.hasTreatmentDischarge ?? false}
      cityId={cityId}
      cityDisplayName={config.displayName}
      mapCenter={mapCenter}
      mapZoom={mapZoom}
      scopeLabel={header.scopeLabel}
      showHeaderStats={header.showStats ?? true}
      atlasCtaLabel={header.atlasCtaLabel}
      riverInfo={riverInfo}
      basin={basinProp}
      overviewBasin={overviewBasinProp}
    />
  );
}
