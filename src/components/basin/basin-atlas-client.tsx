"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import type { BasinFloor, BasinInventory, BasinManifest } from "@/lib/basins";
import { tryGetBasinManifest } from "@/lib/basins";

// Leaflet needs the DOM; load both basin surfaces client-side only.
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
const BasinOverview = dynamic(
  () => import("@/components/basin/basin-overview").then((m) => m.BasinOverview),
  { ssr: false, loading: () => null },
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
  // Basin STACK (docs/specs/cauvery-basin-hierarchy.md §3c): the host page
  // provides the entry basin; navigating the hierarchy (Cauvery -> Arkavati,
  // or "part of the Cauvery Basin" upward) swaps the manifest in place.
  // Manifests come from the client-importable registry; inventories are
  // fetched from the basin's public data directory.
  const [active, setActive] = useState<{ manifest: BasinManifest; inventory: BasinInventory | null }>(
    { manifest: props.manifest, inventory: props.inventory },
  );

  // Follow the host if it hands us a different entry basin.
  useEffect(() => {
    setActive({ manifest: props.manifest, inventory: props.inventory });
  }, [props.manifest, props.inventory]);

  const navigateBasin = (basinId: string) => {
    const manifest = tryGetBasinManifest(basinId);
    if (!manifest) return;
    setActive({ manifest, inventory: null });
    fetch(`/data/basins/${basinId}/inventory.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((inv) => {
        setActive((cur) =>
          cur.manifest.basinId === basinId ? { manifest, inventory: inv as BasinInventory | null } : cur,
        );
      });
  };

  if (active.manifest.overviewMode === "sub-basins") {
    return (
      <BasinOverview
        manifest={active.manifest}
        inventory={active.inventory}
        embedded={props.embedded}
        onClose={props.onClose}
        onNavigateBasin={navigateBasin}
      />
    );
  }

  return (
    <BasinAtlas
      {...props}
      manifest={active.manifest}
      inventory={active.inventory}
      onNavigateBasin={navigateBasin}
    />
  );
}
