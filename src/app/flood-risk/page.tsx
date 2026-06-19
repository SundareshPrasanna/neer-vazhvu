"use client";

import { InteractiveFloodContent } from "@/app/[cityId]/flood-risk/interactive-flood-content";

// Flat /flood-risk URL kept working during transition. The page body now
// lives in the shared route's interactive content component (single source
// of truth); the city route renders the same component via the 'interactive'
// flood variant.
export default function FloodRiskPage() {
  return <InteractiveFloodContent cityId="chennai" />;
}
