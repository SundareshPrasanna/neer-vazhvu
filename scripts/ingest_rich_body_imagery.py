"""
T4a: Yearly imagery ingest for rich-data water bodies.

For each year 1984-2026, pull an era-appropriate cloud-masked yearly
median RGB composite, clip to (body polygon + 1km buffer + margin),
export as JPEG, optionally upload to Supabase storage, and write a
per-body manifest JSON the V0 panel will consume.

Era mapping:
  1984-1998        Landsat 5 TM only
  1999-2012        Landsat 5 + Landsat 7 (L7 SLC-off mitigated by median)
  2013-2018        Landsat 7 + Landsat 8 (S2_SR sparse over India pre-2019)
  2019-2026        Sentinel-2 SR Harmonized (primary)

Output:
  Locally:  /tmp/rich-bodies/<body_id>/imagery/<year>.jpg (always)
  Supabase: <bucket>/rich-bodies/<body_id>/imagery/<year>.jpg (with --upload)
  Manifest: public/data/rich-bodies/<body_id>-imagery-manifest.json

Usage:
  python scripts/ingest_rich_body_imagery.py --body-id pallikaranai
  python scripts/ingest_rich_body_imagery.py --body-id pallikaranai --upload
  python scripts/ingest_rich_body_imagery.py --body-id pallikaranai --years 1990,2000,2010,2020,2026
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nvdm_write import write_artifact  # noqa: E402

from dotenv import load_dotenv
from registry_license import registry_license
from shapely.geometry import box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "neer-vazhvu-api" / ".env")

import ee  # noqa: E402

# ------------------------------- constants -------------------------------

L5 = "LANDSAT/LT05/C02/T1_L2"
L7 = "LANDSAT/LE07/C02/T1_L2"
L8 = "LANDSAT/LC08/C02/T1_L2"
L9 = "LANDSAT/LC09/C02/T1_L2"
S2 = "COPERNICUS/S2_SR_HARMONIZED"

# Landsat C02 L2 SR: physical reflectance = raw * 0.0000275 + (-0.2)
# After scaling, visualise [0.0, 0.3] for true-colour land
L_SR_VIS = {"min": 0.0, "max": 0.30, "gamma": 1.1}

# Sentinel-2 L2A: SR already scaled 0-10000 (reflectance × 10000)
# Visualise [0, 3000]
S2_VIS = {"min": 0, "max": 3000, "gamma": 1.1}

DEFAULT_YEARS = list(range(1984, 2027))  # inclusive
DEFAULT_MAX_DIMENSION = 1200  # px on longer side
BUFFER_MARGIN_M = 200
SATELLITE_EVIDENCE_BUCKET = "satellite-evidence"


# ------------------------------- helpers ---------------------------------

def init_ee() -> None:
    project = os.environ["GEE_CLOUD_PROJECT"]
    key_file = os.environ["GEE_SERVICE_ACCOUNT_FILE"]
    with open(key_file) as f:
        client_email = json.load(f)["client_email"]
    creds = ee.ServiceAccountCredentials(client_email, key_file=key_file)
    ee.Initialize(credentials=creds, project=project)
    print(f"GEE initialised: project={project}")


def load_polygon(path: Path):
    with open(path) as f:
        gj = json.load(f)
    return unary_union([shape(f["geometry"]) for f in gj["features"]])


def compute_chip_bbox(body_polygon, buffer_polygon, margin_m: int):
    """Bounding box covering body + buffer + small margin (in degrees)."""
    union = unary_union([body_polygon, buffer_polygon])
    minx, miny, maxx, maxy = union.bounds
    # Convert margin metres -> degrees (rough at Chennai latitude ~13°N)
    deg_per_m_lat = 1 / 110540
    deg_per_m_lon = 1 / (111320 * 0.974)  # cos(13°) ≈ 0.974
    pad_lat = margin_m * deg_per_m_lat
    pad_lon = margin_m * deg_per_m_lon
    return (minx - pad_lon, miny - pad_lat, maxx + pad_lon, maxy + pad_lat)


def mask_landsat_l2(img):
    qa = img.select("QA_PIXEL")
    cloud = qa.bitwiseAnd(1 << 3).eq(0)
    shadow = qa.bitwiseAnd(1 << 4).eq(0)
    dilated = qa.bitwiseAnd(1 << 1).eq(0)
    return img.updateMask(cloud.And(shadow).And(dilated))


def scale_landsat_sr(img, bands_in: list[str], bands_out: list[str]):
    scaled = (
        img.select(bands_in).multiply(0.0000275).add(-0.2).rename(bands_out)
    )
    return scaled


def mask_s2(img):
    scl = img.select("SCL")
    keep = (
        scl.eq(4)
        .Or(scl.eq(5))
        .Or(scl.eq(6))
        .Or(scl.eq(7))
        .Or(scl.eq(11))
    )
    return img.updateMask(keep)


def yearly_median_rgb(year: int, ee_bbox: ee.Geometry):
    """Return (visualised RGB image, primary_sensor_label, scene_count)."""
    start = f"{year}-01-01"
    end = f"{year + 1}-01-01"

    def from_landsat(coll_id, rgb_bands):
        coll = (
            ee.ImageCollection(coll_id)
            .filterDate(start, end)
            .filterBounds(ee_bbox)
            .map(mask_landsat_l2)
            .map(lambda img: scale_landsat_sr(img, rgb_bands, ["R", "G", "B"]))
        )
        return coll

    def from_s2(coll_id):
        coll = (
            ee.ImageCollection(coll_id)
            .filterDate(start, end)
            .filterBounds(ee_bbox)
            .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", 60))
            .map(mask_s2)
            .map(lambda img: img.select(["B4", "B3", "B2"], ["R", "G", "B"]))
        )
        return coll

    if year < 1999:
        coll = from_landsat(L5, ["SR_B3", "SR_B2", "SR_B1"])
        vis = L_SR_VIS
        sensor = "landsat5"
    elif year < 2013:
        l5 = from_landsat(L5, ["SR_B3", "SR_B2", "SR_B1"]) if year < 2012 else None
        l7 = from_landsat(L7, ["SR_B3", "SR_B2", "SR_B1"])
        coll = l5.merge(l7) if l5 is not None else l7
        vis = L_SR_VIS
        sensor = "landsat5+7" if year < 2012 else "landsat7"
    elif year < 2019:
        # S2 SR sparse over India pre-2019; Landsat 7+8 medians work well
        l7 = from_landsat(L7, ["SR_B3", "SR_B2", "SR_B1"])
        l8 = from_landsat(L8, ["SR_B4", "SR_B3", "SR_B2"])
        coll = l7.merge(l8)
        vis = L_SR_VIS
        sensor = "landsat7+8"
    else:
        coll = from_s2(S2)
        vis = S2_VIS
        sensor = "sentinel2"

    count = coll.size().getInfo()
    if count == 0:
        return None, sensor, 0

    median = coll.median()
    visualized = median.select(["R", "G", "B"]).visualize(**vis)
    return visualized, sensor, count


def fetch_chip_jpeg(image: ee.Image, ee_bbox: ee.Geometry, max_dim: int) -> bytes:
    """Get a JPEG byte-string for the visualized image inside ee_bbox."""
    url = image.getThumbURL(
        {
            "region": ee_bbox,
            "dimensions": max_dim,
            "format": "jpg",
            "crs": "EPSG:4326",
        }
    )
    with urllib.request.urlopen(url, timeout=120) as resp:
        return resp.read()


def write_local(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def upload_supabase(remote_path: str, data: bytes, content_type: str) -> str:
    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    sb = create_client(url, key)
    bucket = sb.storage.from_(SATELLITE_EVIDENCE_BUCKET)
    options = {"content-type": content_type, "upsert": "true"}
    try:
        bucket.upload(remote_path, data, options)
    except Exception:
        bucket.update(remote_path, data, options)
    return f"{url}/storage/v1/object/public/{SATELLITE_EVIDENCE_BUCKET}/{remote_path}"


# --------------------------------- main ----------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--body-id", required=True)
    ap.add_argument("--years", default=None, help="comma list (e.g. 1990,2000,2026)")
    ap.add_argument("--upload", action="store_true", help="upload to Supabase storage")
    ap.add_argument("--max-dim", type=int, default=DEFAULT_MAX_DIMENSION)
    ap.add_argument("--margin-m", type=int, default=BUFFER_MARGIN_M)
    args = ap.parse_args()

    body_id = args.body_id
    years = [int(y) for y in args.years.split(",")] if args.years else DEFAULT_YEARS

    init_ee()

    geom_dir = ROOT / "public/geojson/rich-bodies"
    body_polygon = load_polygon(geom_dir / f"{body_id}.geojson")
    buffer_polygon = load_polygon(geom_dir / f"{body_id}-buffer-1000m.geojson")

    bbox = compute_chip_bbox(body_polygon, buffer_polygon, args.margin_m)
    ee_bbox = ee.Geometry.Rectangle(list(bbox))
    print(f"Body: {body_id}")
    print(f"Chip bbox (W, S, E, N): {bbox}")
    aspect = (bbox[2] - bbox[0]) / (bbox[3] - bbox[1])
    print(f"Aspect (W/H): {aspect:.3f}; max dim {args.max_dim}px")

    local_dir = Path("/tmp/rich-bodies") / body_id / "imagery"
    local_dir.mkdir(parents=True, exist_ok=True)

    # Merge new chips into any existing manifest so a partial re-run
    # (e.g. `--years 2025,2026`) extends the historical chip list rather
    # than replacing it. Years requested again will be re-fetched and
    # overwrite their old entry (intentional - lets us refresh stale
    # composites).
    manifest_path = (
        ROOT / "public/data/rich-bodies" / f"{body_id}-imagery-manifest.json"
    )
    chips: list[dict] = []
    existing_chips_by_year: dict[int, dict] = {}
    # The tint blocks are written into this same manifest by the two
    # ingest_rich_body_*_tint.py scripts. They are NOT regenerated here,
    # so they have to be carried across or a partial imagery re-run
    # (`--years 2004,2020`) silently deletes a body's water-loss and
    # built-gain overlays - the chips merge correctly and the tints just
    # vanish, with nothing in the output to say so.
    existing_tints: dict | None = None
    if manifest_path.exists():
        try:
            existing = json.loads(manifest_path.read_text())
            for c in existing.get("chips", []):
                existing_chips_by_year[int(c["year"])] = c
            existing_tints = existing.get("tints")
        except Exception as e:
            print(f"  warning: could not read existing manifest: {e}")

    for year in years:
        t0 = time.time()
        try:
            visualized, sensor, scene_count = yearly_median_rgb(year, ee_bbox)
        except Exception as e:
            print(f"  {year}: GEE error: {e}")
            chips.append(
                {"year": year, "sensor": "error", "available": False, "scene_count": 0}
            )
            continue

        if visualized is None or scene_count == 0:
            print(f"  {year}: no scenes available ({sensor})")
            chips.append(
                {"year": year, "sensor": sensor, "available": False, "scene_count": 0}
            )
            continue

        try:
            jpeg = fetch_chip_jpeg(visualized, ee_bbox, args.max_dim)
        except Exception as e:
            print(f"  {year}: chip fetch failed: {e}")
            chips.append(
                {
                    "year": year,
                    "sensor": sensor,
                    "available": False,
                    "scene_count": scene_count,
                    "error": str(e),
                }
            )
            continue

        local_path = local_dir / f"{year}.jpg"
        write_local(local_path, jpeg)
        size_kb = len(jpeg) // 1024

        remote_path = f"rich-bodies/{body_id}/imagery/{year}.jpg"
        public_url = None
        if args.upload:
            try:
                public_url = upload_supabase(remote_path, jpeg, "image/jpeg")
            except Exception as e:
                print(f"  {year}: upload failed: {e}")

        elapsed = time.time() - t0
        print(
            f"  {year}: {sensor:>14}  scenes={scene_count:>3}  size={size_kb:>3}KB  "
            f"t={elapsed:>4.1f}s  {'uploaded' if public_url else 'local'}"
        )

        chips.append(
            {
                "year": year,
                "sensor": sensor,
                "available": True,
                "scene_count": scene_count,
                "size_kb": size_kb,
                "local_path": str(local_path),
                "remote_path": remote_path,
                "public_url": public_url,
            }
        )

    # Merge: years we just processed (in `chips`) override any same-year
    # entries from a previous run; everything else (e.g. 1990-2024 from
    # an earlier full run) carries over.
    just_processed = {int(c["year"]) for c in chips}
    for old_year, old_chip in existing_chips_by_year.items():
        if old_year not in just_processed:
            chips.append(old_chip)
    chips.sort(key=lambda c: c["year"])

    available_count = sum(1 for c in chips if c.get("available"))
    print(f"\nDone: {available_count}/{len(chips)} chips available (incl. {len(existing_chips_by_year) - sum(1 for y in existing_chips_by_year if y in just_processed)} carried over from prior runs)")

    manifest = {
        "body_id": body_id,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "chip_bbox_wsen": list(bbox),
        "chip_max_dimension_px": args.max_dim,
        "chip_aspect_w_over_h": round(aspect, 4),
        "era_map": {
            "1984-1998": "Landsat 5 TM",
            "1999-2012": "Landsat 5 + 7",
            "2013-2018": "Landsat 7 + 8",
            "2019-present": "Sentinel-2 SR Harmonized",
        },
        "storage_bucket": SATELLITE_EVIDENCE_BUCKET if args.upload else None,
        "license": (
            f"Landsat: {registry_license('usgs-landsat')}. "
            f"Sentinel-2: {registry_license('sentinel-2-l2a')}. "
            "NICFI: when added, Planet Labs PBC under NICFI public licence."
        ),
        "chips": chips,
    }
    if existing_tints:
        manifest["tints"] = existing_tints
        print(f"Carried forward {len(existing_tints)} tint layer(s) from the prior manifest")
    # `manifest_path` was already defined earlier (top of main) for the
    # existing-manifest read; reuse it for the write.
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    write_artifact(manifest_path, manifest)
    print(f"Wrote manifest: {manifest_path}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nFAILED: {e}", file=sys.stderr)
        sys.exit(1)
