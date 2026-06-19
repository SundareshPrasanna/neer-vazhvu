"use client";

import { RichWaterBodiesContent } from "@/app/[cityId]/water-bodies/rich-water-bodies-content";

// Flat /water-bodies URL kept working during transition. The page body now
// lives in the shared route's parametrized rich content component (single
// source of truth); the city route renders the same component via its
// capability-flag branch.
export default function WaterBodiesPage() {
  return <RichWaterBodiesContent cityId="chennai" />;
}
