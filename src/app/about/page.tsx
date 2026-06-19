import { getPlaceConfig } from "@/lib/cities";
import { loadCascadeStats } from "@/lib/cascade-stats-loader";
import { loadCascadeSensitivity } from "@/lib/cascade-sensitivity-loader";
import { CityAboutContent } from "../[cityId]/about/about-content";

export const metadata = {
  title: "About | Neer Vazhvu",
  description: "Methodology, data sources, and assumptions behind Neer Vazhvu, the Urban Water Intelligence platform - this page covers the Chennai dashboard.",
};

// The flat /about route renders the same shared CityAboutContent shell that
// /chennai/about renders, configured for Chennai. Kept working through the
// Chennai-namespace migration so the legacy /about URL stays identical.
export default function AboutPage() {
  const config = getPlaceConfig("chennai");
  const cascadeStats = config.hasCascadeOverlay ? loadCascadeStats("chennai") : null;
  const cascadeSensitivity = config.hasCascadeOverlay
    ? loadCascadeSensitivity("chennai")
    : null;
  return (
    <CityAboutContent
      config={config}
      cascadeStats={cascadeStats}
      cascadeSensitivity={cascadeSensitivity}
    />
  );
}
