import { loadCascadeStats } from "@/lib/cascade-stats-loader";
import { loadCascadeSensitivity } from "@/lib/cascade-sensitivity-loader";
import { AboutContent } from "./about-content";

export const metadata = {
  title: "About | Neer Vazhvu",
  description: "Methodology, data sources, and assumptions behind Neer Vazhvu, the Urban Water Intelligence platform - this page covers the Chennai dashboard.",
};

export default function AboutPage() {
  const cascadeStats = loadCascadeStats("chennai");
  const cascadeSensitivity = loadCascadeSensitivity("chennai");
  return (
    <AboutContent
      cascadeStats={cascadeStats}
      cascadeSensitivity={cascadeSensitivity}
    />
  );
}
