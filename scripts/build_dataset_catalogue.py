#!/usr/bin/env python3
"""Dataset catalogue builder.

Inventories every file-artifact dataset under public/data and public/geojson
and joins each file to (a) the code that reads it, (b) the scripts that build
it, and (c) its Headwaters source-registry entries (via dependsOn paths).

The unit of analysis is the LOGICAL DATASET (the filename stem with the city
token stripped), not the file: `madurai-ward-profiles.json` and
`ward-profiles.json` (Chennai legacy name) are two rows of one dataset.

Outputs:
  docs/architecture/dataset-catalogue.json   (machine-readable, full detail)
  docs/architecture/dataset-catalogue.md     (human summary)

Stdlib only; uses `rg` for the reference scan. Run from anywhere:
  python3 scripts/build_dataset_catalogue.py
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIRS = ["public/data", "public/geojson"]
CODE_DIRS = ["src", "scripts", "neer-vazhvu-api", "supabase"]
OUT_JSON = ROOT / "docs/architecture/dataset-catalogue.json"
OUT_MD = ROOT / "docs/architecture/dataset-catalogue.md"

CITY_TOKENS = [
    "chennai", "bangalore", "madurai", "mumbai", "delhi", "hyderabad", "kolkata", "gurugram",
    "pune",
    "surat",
]
BASIN_SCOPES = {"arkavathi", "cauvery-ka", "cauvery-tn", "chennai-rivers", "kabini"}

# Chennai-era unprefixed filenames (see src/lib/cities/data-paths.ts).
CHENNAI_LEGACY = {
    "restoration-priority.json",
    "ward-profiles.json",
    "ward-names.json",
    "river-quality.json",
    "industrial-sources.json",
    "cooum-sewage-inlets.json",
}

# Files whose city isn't in the filename: publisher acronyms and
# Chennai-era unprefixed names that predate the city-token convention.
SCOPE_HINTS = {
    # BBMB = Bhakra Beas Management Board: Delhi's upstream storage (consumed
    # by src/lib/cities/delhi.ts; the dams records carry city_id "delhi").
    # Was mis-hinted "bangalore" until 2026-07-30.
    "bbmb-dam-storage.json": "delhi",
    "cag-djb-audit-2025.json": "delhi",
    "dusib-jj-bastis.json": "delhi",
    "mmr-corporations-water.json": "mumbai",
    "mmr-dam-storage.json": "mumbai",
    "gee-phase1-water-body-targets.json": "chennai",
    "gw-stations.json": "chennai",
    "gwr-blocks.json": "chennai",
    "imd-rainfall-monthly.json": "chennai",
    "restoration-projects.json": "chennai",
    "ward-representatives.json": "chennai",
    "tamil-nadu-boundary.geojson": "tamil-nadu",
}

# TS template literals / Python f-strings that build per-city file names.
TEMPLATE_TOKENS = ["${cityId}", "${city}", "{city_id}", "{cityId}", "{city}"]

BIG_FILE_BYTES = 5 * 1024 * 1024


def load_registry() -> tuple[dict[str, list[dict]], list[tuple[str, dict]], int]:
    """Registry lineage in both its forms: exact file paths and directory
    prefixes (the GROUPS convention - `public/data/cascade` names the whole
    machine-generated cohort; per-file lineage there would be noise)."""
    by_path: dict[str, list[dict]] = defaultdict(list)
    dir_prefixes: list[tuple[str, dict]] = []
    n_sources = 0
    for f in sorted((ROOT / "scripts/source-registry").glob("*.json")):
        doc = json.loads(f.read_text())
        for src in doc.get("sources", []):
            n_sources += 1
            entry = {
                "id": src.get("id"),
                "scope": src.get("scope"),
                "license": src.get("license"),
                "refreshMethod": src.get("refreshMethod"),
            }
            for dep in src.get("dependsOn", []):
                dep = dep.lstrip("/")
                if dep.startswith("supabase:"):
                    continue
                if (ROOT / dep).is_dir():
                    dir_prefixes.append((dep.rstrip("/") + "/", entry))
                else:
                    by_path[dep].append(entry)
    return by_path, dir_prefixes, n_sources


def load_coverage_allowlist() -> dict[str, str]:
    """The UNWATCHED map from scripts/lib/headwaters-coverage.ts: artifacts
    with no registry entry and an explicit reason on record (continuous
    sources like OSM/Dynamic World, derived artifacts, closed series). This is
    the platform's second accountability track; the catalogue must see it or
    every deliberate allowlist decision reads as a coverage gap.

    Parsed by regex from the TS source - the single source of truth stays in
    the coverage gate; if the format changes this returns {} and the
    conformance numbers drop loudly rather than silently lying."""
    ts = (ROOT / "scripts/lib/headwaters-coverage.ts").read_text()
    m = re.search(r"UNWATCHED[^=]*=\s*\{(.*?)\n\};", ts, re.S)
    if not m:
        return {}
    return {
        p: reason
        for p, reason in re.findall(r'"(public/[^"]+)":\s*"([^"]*)"', m.group(1))
    }


def load_rich_body_cities() -> dict[str, str]:
    """slug -> city_id from rich-body-registry.ts (best-effort regex parse)."""
    ts = (ROOT / "src/lib/water-bodies/rich-body-registry.ts").read_text()
    pairs: dict[str, str] = {}
    current_id = None
    for m in re.finditer(r'(?<![a-zA-Z_])(id|city_id):\s*"([^"]+)"', ts):
        key, val = m.group(1), m.group(2)
        if key == "id":
            current_id = val
        elif key == "city_id" and current_id:
            pairs[current_id] = val
            current_id = None
    return pairs


def detect_scope_and_stem(rel: Path, rich_slugs: dict[str, str]) -> tuple[str, str]:
    """Return (scope, dataset stem). Scope is a city id, basin id, or 'unknown'."""
    name = rel.name
    stem_full = re.sub(r"\.(geo)?json$", "", name)
    parts = rel.parts  # e.g. ('public','data','cascade','x.json')

    # Directory-scoped families first. Nested layer shards
    # (basins/<scope>/<layer>/<shard>.geojson) belong to the LAYER dataset -
    # the shard filename is a chunk id (shed code, river name), not identity.
    if "basins" in parts:
        for scope in BASIN_SCOPES:
            if scope in parts:
                sub = parts[parts.index(scope) + 1 : -1]
                return scope, ("/".join(sub) if sub else stem_full)
        return "unknown", stem_full
    if "corridors" in parts:
        i = parts.index("corridors")
        sub = parts[i + 2 : -1]
        return parts[i + 1], ("/".join(sub) if sub else stem_full)
    if "waterways" in parts:
        i = parts.index("waterways")
        sub = parts[i + 2 : -1]
        return parts[i + 1], ("/".join(sub) if sub else stem_full)
    if "atlas" in parts:
        # atlas/<state>/<district>/<family>[/<shard>]: the scope is the
        # state-prefixed district id registered in schemas/nvdm/scopes.json
        # (tn-thanjavur); per-block shards belong to the FAMILY dataset, the
        # shard filename is a block code, not identity.
        i = parts.index("atlas")
        if len(parts) > i + 3:
            sub = parts[i + 3 : -1]
            return f"{parts[i + 1]}-{parts[i + 2]}", ("/".join(sub) if sub else stem_full)
        if len(parts) == i + 3:
            # atlas/<state>/<artifact>.json: the state tier's own artifacts
            # (the first is the Maharashtra scarcity register). The scope is
            # the registered STATE scope, not a district.
            state = {"tn": "tamil-nadu", "mh": "maharashtra"}.get(parts[i + 1])
            if state:
                return state, stem_full
        return "unknown", stem_full
    if "rich-bodies" in parts:
        for slug, city in sorted(rich_slugs.items(), key=lambda kv: -len(kv[0])):
            if stem_full == slug or stem_full.startswith(slug + "-"):
                return city, stem_full[len(slug):].lstrip("-") or "polygon"
        return "unknown", stem_full

    if name in CHENNAI_LEGACY:
        return "chennai", stem_full
    if name in SCOPE_HINTS:
        return SCOPE_HINTS[name], stem_full

    for city in CITY_TOKENS:
        if stem_full == city:
            return city, stem_full
        if stem_full.startswith(city + "-"):
            return city, stem_full[len(city) + 1 :]
        if stem_full.endswith("-" + city):
            return city, stem_full[: -(len(city) + 1)]
        if f"-{city}-" in stem_full:
            return city, stem_full.replace(f"-{city}-", "-", 1)
    return "unknown", stem_full


def fingerprint(path: Path) -> dict:
    """Cheap structural fingerprint of a JSON/GeoJSON file."""
    try:
        doc = json.loads(path.read_text())
    except Exception as e:  # noqa: BLE001 - report parse failures in the catalogue
        return {"parse_error": str(e)[:120]}
    if isinstance(doc, dict) and doc.get("type") == "FeatureCollection":
        feats = doc.get("features", [])
        geoms = sorted({(f.get("geometry") or {}).get("type", "null") for f in feats[:200]})
        props = sorted((feats[0].get("properties") or {}).keys()) if feats else []
        return {"kind": "FeatureCollection", "features": len(feats), "geometries": geoms, "property_keys": props[:40]}
    if isinstance(doc, dict):
        # Indexed collections (maps keyed by external ids, e.g. cascade
        # catchment-* keyed by OSM id): fingerprint the RECORD shape, not the
        # keys - key sets are data, not schema, and comparing them across
        # cities manufactures fake drift.
        keys = list(doc.keys())
        id_like = [k for k in keys if re.fullmatch(r"\d{4,}", k)]
        if len(keys) >= 5 and len(id_like) / len(keys) >= 0.8:
            first = doc[id_like[0]]
            elem = sorted(first.keys())[:40] if isinstance(first, dict) else []
            return {"kind": "indexed-collection", "records": len(keys), "element_keys": elem}
        return {"kind": "object", "keys": sorted(keys)[:40]}
    if isinstance(doc, list):
        elem_keys = sorted(doc[0].keys())[:40] if doc and isinstance(doc[0], dict) else []
        return {"kind": "array", "length": len(doc), "element_keys": elem_keys}
    return {"kind": type(doc).__name__}


CODE_EXTS = {".ts", ".tsx", ".js", ".mjs", ".py", ".sql", ".sh", ".yml", ".yaml"}


def scan_references(files: list[Path]) -> dict[str, set[str]]:
    """One pass over the code tree: pattern -> set of repo-relative files containing it.

    Patterns are basenames plus city-stripped variants, so templated paths
    like `${cityId}-ward-profiles.json` in data-paths.ts still match via the
    fixed substring `ward-profiles.json`. Pure Python (no rg dependency):
    a single compiled alternation regex, applied per code file.
    """
    patterns: set[str] = set()
    for f in files:
        patterns.add(f.name)
        for city in CITY_TOKENS:
            if city in f.name:
                patterns.add(f.name.replace(city, "", 1).replace("--", "-").lstrip("-"))
                for tok in TEMPLATE_TOKENS:
                    patterns.add(f.name.replace(city, tok, 1))
    patterns = {p for p in patterns if len(p) > 6}
    rx = re.compile("|".join(re.escape(p) for p in sorted(patterns, key=len, reverse=True)))

    hits: dict[str, set[str]] = defaultdict(set)
    for d in CODE_DIRS:
        for path in (ROOT / d).rglob("*"):
            if path.suffix not in CODE_EXTS or not path.is_file():
                continue
            rel = str(path.relative_to(ROOT))
            if rel.startswith("scripts/source-registry/") or rel.endswith(
                (
                    "build_dataset_catalogue.py",
                    "validate_nvdm.py",
                    "lib/headwaters-coverage.ts",
                    "nvdm-encumbrance-report.py",
                    "check-sample-corpus.py",
                    "check-generator-drift.py",
                    "check-mirrored-documents.py",
                )
            ):
                continue  # tooling/governance files mention filenames without producing/consuming
                # them - counting the coverage allowlist as a producer hid a known orphan
            if "node_modules" in rel or path.stat().st_size > 2_000_000:
                continue
            try:
                content = path.read_text(errors="ignore")
            except OSError:
                continue
            for match in set(rx.findall(content)):
                hits[match].add(rel)
    return hits


def refs_for(name: str, hits: dict[str, set[str]]) -> tuple[list[str], list[str]]:
    """(consumers in src/, producer/refs in scripts+api+supabase) for a basename."""
    keys = {name}
    for city in CITY_TOKENS:
        if city in name:
            keys.add(name.replace(city, "", 1).replace("--", "-").lstrip("-"))
            for tok in TEMPLATE_TOKENS:
                keys.add(name.replace(city, tok, 1))
    found: set[str] = set()
    for k in keys:
        found |= hits.get(k, set())
    consumers = sorted(f for f in found if f.startswith("src/"))
    producers = sorted(f for f in found if not f.startswith("src/"))
    return consumers, producers


def family_of(rel: Path) -> str:
    parts = rel.parts
    if parts[1] == "geojson":
        return "geojson-layers"
    if len(parts) > 3:
        return parts[2]  # cascade, rich-bodies, basins, corridors, ingres
    return "data-root"


def convention_blob() -> str:
    """Concatenated source of the registry-driven loaders (basin atlas,
    corridors). Files under public/data/basins/<basin>/ are fetched via
    constructed paths (layer family + shed id), so basename search can't see
    them; a file counts as convention-consumed if its scope id appears here."""
    blob = []
    for d in ("src/lib/basins", "src/lib/corridors", "src/app"):
        p = ROOT / d
        if p.is_dir():
            for f in p.rglob("*.ts*"):
                if "node_modules" not in str(f):
                    blob.append(f.read_text(errors="ignore"))
    return "\n".join(blob)


def main() -> None:
    registry_by_path, registry_prefixes, n_sources = load_registry()
    allowlist = load_coverage_allowlist()
    rich_slugs = load_rich_body_cities()
    conv_blob = convention_blob()

    files = sorted(
        p
        for d in DATA_DIRS
        for p in (ROOT / d).rglob("*")
        if p.suffix in (".json", ".geojson") and p.is_file()
    )
    hits = scan_references(files)

    records = []
    for path in files:
        rel = path.relative_to(ROOT)
        scope, stem = detect_scope_and_stem(rel, rich_slugs)
        consumers, producers = refs_for(path.name, hits)
        if not consumers and family_of(rel) in ("basins", "corridors") and f'"{scope}"' in conv_blob:
            consumers = [f"(convention: registry-driven loader for '{scope}')"]
        rel_str = str(rel)
        sources = list(registry_by_path.get(rel_str, []))
        sources += [e for prefix, e in registry_prefixes if rel_str.startswith(prefix)]
        # Accountability track (mirrors the headwaters coverage gate):
        # watched (registry lineage) > allowlisted (explicit reason on record,
        # exact path or GROUPS directory) > unaccounted.
        allow_reason = allowlist.get(rel_str) or next(
            (r for p, r in allowlist.items() if rel_str.startswith(p.rstrip("/") + "/")), None
        )
        if sources:
            track = "watched"
        elif allow_reason:
            track = "allowlisted"
        else:
            track = "unaccounted"
        rec = {
            "path": str(rel),
            "family": family_of(rel),
            "scope": scope,
            "dataset": stem,
            "bytes": path.stat().st_size,
            "schema": fingerprint(path),
            "consumers": consumers,
            "producer_refs": producers,
            "headwaters_sources": sorted({s["id"] for s in sources}),
            "licenses": sorted({s["license"] for s in sources if s.get("license")}),
            "accountability": track,
            "accountability_reason": allow_reason,
            "flags": sorted(
                filter(
                    None,
                    [
                        "chennai-legacy-name" if path.name in CHENNAI_LEGACY else None,
                        "unaccounted" if track == "unaccounted" else None,
                        "orphan" if not consumers and not producers and not sources else None,
                        "big" if path.stat().st_size > BIG_FILE_BYTES else None,
                        "unknown-scope" if scope == "unknown" else None,
                    ],
                )
            ),
        }
        records.append(rec)

    # ---- aggregate by logical dataset ----
    datasets: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in records:
        datasets[(r["family"], r["dataset"])].append(r)

    ds_rows = []
    for (family, stem), recs in sorted(datasets.items()):
        scopes = sorted({r["scope"] for r in recs})
        key_sets = {json.dumps(r["schema"].get("property_keys") or r["schema"].get("keys") or r["schema"].get("element_keys") or []) for r in recs}
        ds_rows.append(
            {
                "family": family,
                "dataset": stem,
                "files": len(recs),
                "scopes": scopes,
                "bytes": sum(r["bytes"] for r in recs),
                "schema_variants": len(key_sets),
                "registered": any(r["accountability"] != "unaccounted" for r in recs),
                "has_consumer": any(r["consumers"] for r in recs),
            }
        )

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps({"files": records, "datasets": ds_rows}, indent=1))

    # ---- markdown summary ----
    mb = lambda b: f"{b / 1048576:.1f}"  # noqa: E731
    total_bytes = sum(r["bytes"] for r in records)
    fam_stats: dict[str, dict] = defaultdict(
        lambda: {"files": 0, "bytes": 0, "watched": 0, "allowlisted": 0, "scopes": set()}
    )
    for r in records:
        s = fam_stats[r["family"]]
        s["files"] += 1
        s["bytes"] += r["bytes"]
        if r["accountability"] == "watched":
            s["watched"] += 1
        elif r["accountability"] == "allowlisted":
            s["allowlisted"] += 1
        s["scopes"].add(r["scope"])

    multi = [d for d in ds_rows if len([s for s in d["scopes"] if s in CITY_TOKENS]) >= 2]
    single = [d for d in ds_rows if len([s for s in d["scopes"] if s in CITY_TOKENS]) == 1]
    orphans = [r for r in records if "orphan" in r["flags"]]
    unaccounted = [r for r in records if r["accountability"] == "unaccounted"]
    drift = [d for d in multi if d["schema_variants"] > 1]

    lines = [
        "# Dataset catalogue (file artifacts)",
        "",
        f"Generated by `scripts/build_dataset_catalogue.py` against {', '.join(f'`{d}`' for d in DATA_DIRS)}.",
        "Machine-readable detail: `dataset-catalogue.json` (per-file schema fingerprints, consumers, producers, Headwaters joins).",
        "",
        f"**{len(records)} files · {mb(total_bytes)} MB · {len(ds_rows)} logical datasets · "
        f"{n_sources} Headwaters sources. Accountability: "
        f"{sum(1 for r in records if r['accountability'] == 'watched')} watched · "
        f"{sum(1 for r in records if r['accountability'] == 'allowlisted')} allowlisted · "
        f"{sum(1 for r in records if r['accountability'] == 'unaccounted')} unaccounted.**",
        "",
        "## Families",
        "",
        "| family | files | MB | scopes | watched | allowlisted |",
        "|---|--:|--:|--:|--:|--:|",
    ]
    for fam, s in sorted(fam_stats.items(), key=lambda kv: -kv[1]["bytes"]):
        lines.append(
            f"| {fam} | {s['files']} | {mb(s['bytes'])} | {len(s['scopes'])} | {s['watched']} | {s['allowlisted']} |"
        )

    lines += [
        "",
        "## Standardization signal",
        "",
        f"- Logical datasets present in **2+ cities**: {len(multi)}",
        f"- Logical datasets in **exactly 1 city** (bespoke): {len(single)}",
        f"- Multi-city datasets whose per-city files have **divergent schemas**: {len(drift)}",
        "",
        "### Multi-city datasets with schema drift (fix-first list for NVDM)",
        "",
        "| family | dataset | cities | schema variants |",
        "|---|---|---|--:|",
    ]
    for d in sorted(drift, key=lambda d: -d["schema_variants"]):
        lines.append(f"| {d['family']} | {d['dataset']} | {', '.join(d['scopes'])} | {d['schema_variants']} |")

    lines += [
        "",
        "## Hygiene",
        "",
        f"- **Orphans** (no consumer, no producer script, no Headwaters source): {len(orphans)}",
    ]
    for r in orphans:
        lines.append(f"  - `{r['path']}` ({mb(r['bytes'])} MB)")
    lines += [
        f"- **Unaccounted files** (no registry lineage AND no allowlist reason): {len(unaccounted)} of {len(records)}",
        f"- **Chennai legacy unprefixed names**: {sum(1 for r in records if 'chennai-legacy-name' in r['flags'])}",
        f"- **Unknown scope** (city not derivable from path): {sum(1 for r in records if 'unknown-scope' in r['flags'])}",
        "",
        "## Largest files",
        "",
        "| MB | path | consumers |",
        "|--:|---|--:|",
    ]
    for r in sorted(records, key=lambda r: -r["bytes"])[:15]:
        lines.append(f"| {mb(r['bytes'])} | `{r['path']}` | {len(r['consumers'])} |")
    lines.append("")

    OUT_MD.write_text("\n".join(lines))
    print(f"{len(records)} files, {len(ds_rows)} datasets -> {OUT_MD.relative_to(ROOT)}")


if __name__ == "__main__":
    sys.exit(main())
