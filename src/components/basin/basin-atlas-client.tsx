"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import type { BasinFloor, BasinInventory, BasinManifest } from "@/lib/basins";

// Leaflet needs the DOM; load the atlas client-side only.
const BasinAtlas = dynamic(
  () => import("@/components/basin/basin-atlas").then((m) => m.BasinAtlas),
  {
    ssr: false,
    loading: () => (
      <div className="h-[calc(100vh-64px)] w-full flex items-center justify-center text-sm text-slate-500">
        Loading basin atlas…
      </div>
    ),
  },
);

export function BasinAtlasClient(props: {
  cityId: string;
  cityDisplayName: string;
  manifest: BasinManifest;
  inventory: BasinInventory | null;
  initialRiverId?: string | null;
  initialFloor?: BasinFloor;
  embedded?: boolean;
  onClose?: () => void;
  renderFeatureDetail?: (args: {
    family: string;
    props: Record<string, unknown>;
    onClose: () => void;
  }) => ReactNode | null;
}) {
  return <BasinAtlas {...props} />;
}
