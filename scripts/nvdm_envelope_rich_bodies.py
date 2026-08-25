"""Stamp NVDM envelopes on rich-body deep-zoom artifacts, for every city.

The rich-body pipeline is body-agnostic and its provenance is identical
whichever city a body sits in: the same six producers, the same registered
sources, the same method. Copying that block into each nvdm_envelope_<city>.py
was already two copies (Mumbai, Hyderabad) and Delhi, Kolkata, Pune and
Gurugram would have made six. So it lives here once instead, and scope is
derived the same way build_dataset_catalogue.py derives it: by reading
city_id out of the rich-body registry, which is the only place that mapping
is authoritative.

This also sidesteps a real blocker. nvdm_envelope_delhi.py currently refuses
to run at all because an unrelated artifact (bbmb-dam-storage) has no
provenance map, and Kolkata, Pune and Gurugram have no envelope script of
their own. Rich bodies should not wait on any of that.

Usage:
  python scripts/nvdm_envelope_rich_bodies.py
  python scripts/nvdm_envelope_rich_bodies.py --refresh   # recompute in place
  python scripts/nvdm_envelope_rich_bodies.py --city pune
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from registry_license import registry_license  # noqa: E402

# Overture publishes quarterly and the release id IS the evidence vintage, so
# it is read from the artifact rather than pinned here.
OVERTURE_FALLBACK_RELEASE = "2026-08-19.0"

OSM = {
    "id": "osm-overpass",
    "title": "OpenStreetMap (Overpass API extract)",
    "publisher": "OpenStreetMap contributors",
    "license": registry_license("osm-overpass"),
}
LANDSAT = {
    "id": "usgs-landsat",
    "title": "Landsat 5/7/8 surface reflectance archive (GEE collections)",
    "publisher": "USGS / NASA (Landsat program)",
    "license": registry_license("usgs-landsat"),
    "role": "input",
}
SENTINEL2 = {
    "id": "sentinel-2-l2a",
    "title": "Sentinel-2 L2A imagery (channel evidence)",
    "publisher": "ESA Copernicus",
    "license": registry_license("sentinel-2-l2a"),
    "role": "input",
}
DYNAMIC_WORLD = {
    "id": "google-dynamic-world",
    "title": "Google Dynamic World built-up classification",
    "publisher": "Google / World Resources Institute",
    "license": registry_license("google-dynamic-world"),
    "role": "input",
}
JRC_GSW = {
    "id": "jrc-global-surface-water",
    "title": "JRC Global Surface Water v1.4 yearly history (JRC/GSW1_4/YearlyHistory)",
    "publisher": "European Commission JRC (Pekel et al.)",
    "license": registry_license("jrc-global-surface-water"),
    "role": "input",
}
OPEN_BUILDINGS = {
    "id": "google-open-buildings",
    "title": "Google Open Buildings v3 polygons",
    "publisher": "Google Research",
    "license": registry_license("google-open-buildings"),
    "role": "input",
    "as_of": "2023",
}
OVERTURE = {
    "id": "overture-buildings",
    "title": "Overture Maps building footprints",
    "publisher": "Overture Maps Foundation",
    "license": registry_license("overture-buildings"),
    "role": "input",
}

# suffix under public/data/rich-bodies -> (dataset, spec)
DATA_SPECS = {
    "jrc-water-trend": ("rich-bodies/jrc-water-trend", {
        "method": "gee",
        "produced_by": "scripts/verify_rich_body_water_trend.py",
        "sources": [JRC_GSW],
        "note": (
            "Zonal annual water-class statistics; JRC v1.4 cutoff is 2021 (no later "
            "years). Method, classes and known_limitations in the legacy data_source key."
        ),
    }),
    "dw-water-trend": ("rich-bodies/dw-water-trend", {
        "method": "gee",
        "produced_by": "scripts/verify_rich_body_dw_water_trend.py",
        "sources": [DYNAMIC_WORLD],
        "note": (
            "Extends the JRC v1.4 water trend past its 2021 cutoff; spliced with JRC at "
            "2021/2022 in the panel chart."
        ),
    }),
    "dynamic-world-built-trend": ("rich-bodies/dynamic-world-built-trend", {
        "method": "gee",
        "produced_by": "scripts/verify_rich_body_built_trend.py",
        "sources": [DYNAMIC_WORLD],
        "note": "Per-pixel annual MODE built-class statistics.",
    }),
    "open-buildings-verification": ("rich-bodies/open-buildings-verification", {
        "method": "gee",
        "produced_by": "scripts/verify_rich_body_open_buildings.py",
        "sources": [OPEN_BUILDINGS],
        "note": "Building-count verification per zone; v3 reflects state around 2023.",
    }),
    "overture-buildings": ("rich-bodies/overture-buildings", {
        "method": "derived",
        "produced_by": "scripts/verify_rich_body_overture_buildings.py",
        "sources": [OVERTURE],
        "note": (
            "Per-building polygon counts from the Overture release named in the "
            "artifact's own data_source.release_date, which is the evidence vintage. "
            "Independent comparison against Google Open Buildings by design."
        ),
    }),
    "imagery-manifest": ("rich-bodies/imagery-manifest", {
        "method": "gee",
        "produced_by": "scripts/ingest_rich_body_imagery.py",
        "sources": [LANDSAT, SENTINEL2],
        "note": (
            "Manifest referencing binary imagery chips (the sanctioned pattern - NVDM "
            "governs the manifest, not the rasters). The chips and tint rasters live in "
            "Supabase storage, not in the corpus."
        ),
    }),
}

GEOJSON_POLYGON = ("geojson-layers/polygon", {
    "method": "api",
    "produced_by": "scripts/fetch-rich-body-polygon.ts",
    "sources": [dict(OSM, title="OpenStreetMap body polygon (Overpass relation/way extract)")],
})
GEOJSON_BUFFER = ("geojson-layers/buffer-1000m", {
    "method": "derived",
    "produced_by": "scripts/fetch-rich-body-polygon.ts",
    "internal_inputs": [],
    "sources": [dict(OSM, title="OpenStreetMap body polygon (Overpass relation/way extract)", role="input")],
    "note": (
        "1 km Minkowski offset of the body polygon (@turf/buffer), not a circle from "
        "the centroid; derived in-memory from the same Overpass fetch, hence "
        "internal_inputs []."
    ),
})

def scope_kinds() -> dict[str, str]:
    """city_id -> scope kind, read from the city configs.

    Some places are regions rather than cities (MMR runs to nine corporations,
    Kolkata likewise), and the envelope's scope.kind has to agree with the
    registry or the L2 gate rejects the artifact. This was hardcoded to
    {"mumbai": "region"} on the first pass, which is exactly the kind of
    guess-from-memory the gate exists to catch: Kolkata is a region too and
    twelve artifacts failed. Derive it instead."""
    kinds: dict[str, str] = {}
    for cfg in (ROOT / "src/lib/cities").glob("*.ts"):
        # Strip comments first. hyderabad.ts contains a paragraph explaining why
        # Hyderabad is NOT a region ("MMR needed placeKind:'region' because...")
        # and a naive match reads that as the setting, which would mis-scope
        # every Hyderabad artifact.
        text = "\n".join(
            line for line in cfg.read_text().splitlines()
            if not line.lstrip().startswith("//")
        )
        m = re.search(r"cityId:\s*['\"]([a-z-]+)['\"]", text)
        if not m:
            continue
        k = re.search(r"placeKind:\s*['\"]([a-z]+)['\"]", text)
        kinds[m.group(1)] = k.group(1) if k else "city"
    return kinds


def registry_cities() -> dict[str, str]:
    """slug -> city_id, parsed from the rich-body registry (the only authority)."""
    ts = (ROOT / "src/lib/water-bodies/rich-body-registry.ts").read_text()
    pairs: dict[str, str] = {}
    cur = None
    for m in re.finditer(r'(?<![a-zA-Z_])(id|city_id):\s*"([^"]+)"', ts):
        k, v = m.group(1), m.group(2)
        if k == "id":
            cur = v
        elif cur:
            pairs[cur] = v
            cur = None
    return pairs


def dump(merged: dict, raw: str) -> str:
    """Preserve the artifact's storage style (see nvdm_envelope_mumbai.dump)."""
    if raw.count("\n") <= 3:
        head = raw[:100_000]
        compact = head.count('","') + head.count('":"') >= head.count('", "') + head.count('": "')
        sep = (",", ":") if compact else (", ", ": ")
        return json.dumps(merged, ensure_ascii=False, separators=sep)
    second = raw.split("\n", 2)[1]
    indent = len(second) - len(second.lstrip(" ")) or 2
    return json.dumps(merged, indent=indent, ensure_ascii=False)


def produced_at(doc: dict) -> str:
    for k in ("computed_at", "generated_at", "fetched_at", "updated"):
        v = doc.get(k)
        if isinstance(v, str) and v[:4].isdigit():
            return v[:10]
    return "1970-01-01"


SCOPE_KINDS: dict[str, str] = {}


def envelope_for(slug: str, city: str, dataset: str, spec: dict, doc: dict) -> dict:
    sources = [dict(s) for s in spec["sources"]]
    if dataset.endswith("overture-buildings"):
        rel = ((doc.get("data_source") or {}).get("release_date")
               or OVERTURE_FALLBACK_RELEASE)
        sources[0]["as_of"] = str(rel)[:7]
    prov = {
        "sources": sources,
        "method": spec["method"],
        "produced_at": produced_at(doc),
        "produced_by": spec["produced_by"],
    }
    if spec.get("internal_inputs") is not None:
        prov["internal_inputs"] = spec["internal_inputs"]
    if spec.get("note"):
        prov["note"] = spec["note"]
    return {
        "nvdm": "1.0",
        "dataset": dataset,
        "scope": {"kind": SCOPE_KINDS.get(city, "city"), "id": city},
        "provenance": prov,
    }


def apply(path: Path, slug: str, city: str, dataset: str, spec: dict, refresh: bool) -> bool:
    raw = path.read_text()
    doc = json.loads(raw)
    if not isinstance(doc, dict):
        return False
    if "nvdm" in doc and not refresh:
        return False
    prior = doc.get("provenance", {}).get("produced_at") if "nvdm" in doc else None
    env = envelope_for(slug, city, dataset, spec, doc)
    if prior:
        env["provenance"]["produced_at"] = prior
    merged = {**env, **{k: v for k, v in doc.items() if k not in env}}
    out = dump(merged, raw)
    path.write_text(out + ("\n" if raw.endswith("\n") else ""))
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--city")
    args = ap.parse_args()

    global SCOPE_KINDS
    SCOPE_KINDS = scope_kinds()
    cities = registry_cities()
    data_dir = ROOT / "public/data/rich-bodies"
    geo_dir = ROOT / "public/geojson/rich-bodies"
    done = skipped = 0
    orphans: list[str] = []

    # longest slug first so "red-hills" wins over any shorter prefix
    slugs = sorted(cities, key=len, reverse=True)

    def slug_for(stem: str) -> str | None:
        for s in slugs:
            if stem == s or stem.startswith(s + "-"):
                return s
        return None

    for path in sorted(data_dir.glob("*.json")):
        stem = path.stem
        slug = slug_for(stem)
        if slug is None:
            orphans.append(path.name)
            continue
        suffix = stem[len(slug):].lstrip("-")
        spec_entry = DATA_SPECS.get(suffix)
        if spec_entry is None:
            orphans.append(path.name)
            continue
        city = cities[slug]
        if args.city and city != args.city:
            continue
        dataset, spec = spec_entry
        if apply(path, slug, city, dataset, spec, args.refresh):
            done += 1
            print(f"enveloped {path.relative_to(ROOT)}")
        else:
            skipped += 1

    for path in sorted(geo_dir.glob("*.geojson")):
        stem = path.stem
        slug = slug_for(stem)
        if slug is None:
            orphans.append(path.name)
            continue
        suffix = stem[len(slug):].lstrip("-")
        if suffix == "":
            dataset, spec = GEOJSON_POLYGON
        elif suffix == "buffer-1000m":
            dataset, spec = GEOJSON_BUFFER
        else:
            orphans.append(path.name)   # e.g. -osm-ecological, which Chennai owns
            continue
        city = cities[slug]
        if args.city and city != args.city:
            continue
        if apply(path, slug, city, dataset, spec, args.refresh):
            done += 1
            print(f"enveloped {path.relative_to(ROOT)}")
        else:
            skipped += 1

    print(f"\n{done} enveloped, {skipped} already carried one")
    if orphans:
        print(f"{len(orphans)} file(s) this script does not own (left alone):")
        for o in orphans[:8]:
            print(f"   {o}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
