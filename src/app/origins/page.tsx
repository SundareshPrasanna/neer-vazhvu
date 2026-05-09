import type { Metadata } from "next";
import { ChennaiStory } from "@/content/story-chennai";

export const metadata: Metadata = {
  title: "City of estuaries: the history of water in Chennai | Neer Vazhvu",
  description:
    "Long-read companion to Chennai's live water dashboard. How a city built on three rivers and three hundred tanks ended up alternating between drowning and running dry.",
  alternates: { canonical: "/origins" },
  openGraph: {
    title: "The history of water in Chennai | Neer Vazhvu",
    description:
      "How a city built on three hundred water bodies ended up alternating between flood and Day Zero.",
    url: "/origins",
    type: "article",
  },
};

export default function ChennaiStoryPage() {
  return <ChennaiStory />;
}
