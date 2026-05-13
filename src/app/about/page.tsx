import { loadCascadeStats } from "@/lib/cascade-stats";
import { loadCascadeSensitivity } from "@/lib/cascade-sensitivity";
import { AboutContent } from "./about-content";

export const metadata = {
  title: "About | Neer Vazhvu",
  description: "Methodology, data sources, and assumptions behind Neer Vazhvu, the Tamil Nadu Water Intelligence platform - this page covers the Chennai dashboard.",
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
