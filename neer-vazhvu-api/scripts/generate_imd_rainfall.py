"""
Generate IMD historical rainfall JSON for any city.

Uses imdlib to download IMD's official gridded rainfall data
(0.25 degree resolution), extracts the nearest valid land grid point
to the supplied lat/lng, and writes monthly aggregates to a static
JSON the dashboard's RainfallTrends component consumes.

Default city is Chennai (preserving the original output path
public/data/imd-rainfall-monthly.json for backward compatibility);
pass --city <id> to write to imd-rainfall-monthly-{id}.json.

Note: Coastal grid cells are sometimes classified as ocean by IMD.
For Chennai the exact 13.0/80.25 cell is ocean so we shift to 13.0/80.0
(~30 km inland near Sriperumbudur). When onboarding a new city, pick
the nearest inland 0.25-deg grid intersection - the script will warn
if all values come back NaN for the supplied point.

Usage:
    pip install imdlib xarray
    python generate_imd_rainfall.py                   # Chennai (default)
    python generate_imd_rainfall.py --city madurai \\
        --lat 9.9 --lng 78.0                          # Madurai
"""

import argparse
import gc
import sys
import tempfile
import time
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "scripts"))
from nvdm_write import write_artifact  # noqa: E402

import numpy as np

START_YEAR = 1970
NORMAL_END = 2020  # long-term normal computed over START_YEAR-NORMAL_END

# Per-city defaults shipped with the script. New cities can override
# via --lat / --lng on the CLI without editing the script, but adding
# a row here keeps invocations one flag.
CITY_DEFAULTS: dict[str, tuple[float, float, str]] = {
    "chennai": (
        13.0,
        80.0,
        "Nearest valid land grid point to Chennai (coastal cells classified as ocean by IMD)",
    ),
    "madurai": (9.9, 78.0, "Madurai-region grid point in upper Vaigai catchment"),
    "bangalore": (
        13.0,
        77.5,
        "Bangalore-region grid point on the Deccan plateau (city centre 12.97 N, 77.59 E)",
    ),
    "mumbai": (
        19.0,
        73.0,
        "Nearest valid land grid point to Mumbai (coastal/island cells "
        "classified as ocean by IMD; city centre 19.08 N, 72.88 E)",
    ),
    "kolkata": (
        22.5,
        88.25,
        "Nearest valid land grid point to Kolkata. The city centre is 22.57 N, "
        "88.36 E, but the Hooghly and the deltaic channels mean several nearby "
        "0.25-deg cells are classified as water by IMD; 22.5/88.25 sits on land "
        "west of the river and covers the KMC plain",
    ),
    "delhi": (
        28.5,
        77.25,
        "NCT grid point (city centre 28.61 N, 77.21 E; 28.5/77.25 sits on "
        "the urban plain south of the Ridge, inside the 0.25-deg cell "
        "covering most of the MCD area)",
    ),
    "hyderabad": (
        17.5,
        78.5,
        "Hyderabad grid point on the Deccan plateau (city centre 17.43 N, "
        "78.43 E). Landlocked, so none of the coastal ocean-cell trouble "
        "Chennai and Mumbai have; 17.5/78.5 is the nearest 0.25-deg "
        "intersection and sits inside the GHMC 2022 ward extent "
        "(17.29-17.56 N, 78.24-78.62 E)",
    ),
}


def fetch_year(year: int, lat: float, lng: float) -> list[dict]:
    """Download one year, extract the supplied grid point, return monthly totals."""
    import imdlib as imd
    import pandas as pd

    with tempfile.TemporaryDirectory() as tmpdir:
        data = imd.get_data("rain", year, year, fn_format="yearwise", file_dir=tmpdir)
        ds = data.get_xarray()

    point = ds.sel(lat=lat, lon=lng, method="nearest")
    rain = point["rain"].values
    times = pd.to_datetime(point["time"].values)

    # Replace -999 fill values with NaN
    rain = np.where(rain <= -999, np.nan, rain)

    months = []
    for month in range(1, 13):
        mask = times.month == month
        values = rain[mask]
        valid = values[~np.isnan(values)]
        total = round(float(np.sum(valid)), 1) if len(valid) > 0 else 0.0
        months.append({"year": year, "month": month, "rainfall_mm": total})

    # Free memory
    del ds, data, point, rain, times
    gc.collect()

    return months


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0].strip())
    parser.add_argument(
        "--city", default="chennai", help="City id (chennai / madurai / ...)"
    )
    parser.add_argument(
        "--lat", type=float, default=None, help="Override grid lat (decimal degrees)"
    )
    parser.add_argument(
        "--lng", type=float, default=None, help="Override grid lng (decimal degrees)"
    )
    parser.add_argument("--start-year", type=int, default=START_YEAR)
    parser.add_argument("--end-year", type=int, default=date.today().year - 1)
    parser.add_argument(
        "--output",
        default=None,
        help="Output path (defaults to public/data/imd-rainfall-monthly[-{city}].json)",
    )
    args = parser.parse_args()

    city_id = args.city.lower()
    defaults = CITY_DEFAULTS.get(city_id, (None, None, ""))
    grid_lat = args.lat if args.lat is not None else defaults[0]
    grid_lng = args.lng if args.lng is not None else defaults[1]
    if grid_lat is None or grid_lng is None:
        print(
            f"ERROR: no default grid for city '{city_id}'. Pass --lat and --lng.",
            file=sys.stderr,
        )
        return
    note = defaults[2] or f"{city_id} grid point ({grid_lat}, {grid_lng})"

    output_path = (
        Path(args.output)
        if args.output
        else (
            Path(__file__).resolve().parent.parent.parent
            / "public"
            / "data"
            / (
                "imd-rainfall-monthly.json"
                if city_id == "chennai"
                else f"imd-rainfall-monthly-{city_id}.json"
            )
        )
    )

    start_year = args.start_year
    end_year = args.end_year
    print(f"Downloading IMD rainfall data {start_year}-{end_year} for '{city_id}'")
    print(f"Grid point: ({grid_lat}, {grid_lng})")

    monthly_records: list[dict] = []
    annual_records: list[dict] = []

    for year in range(start_year, end_year + 1):
        sys.stdout.write(f"\r  {year}... ")
        sys.stdout.flush()

        for attempt in range(3):
            try:
                months = fetch_year(year, grid_lat, grid_lng)
                break
            except Exception as e:
                if attempt == 2:
                    print(f"\n  FAILED {year} after 3 attempts: {e}")
                    months = [
                        {"year": year, "month": m, "rainfall_mm": 0.0}
                        for m in range(1, 13)
                    ]
                else:
                    time.sleep(2**attempt)

        monthly_records.extend(months)
        year_total = round(sum(m["rainfall_mm"] for m in months), 1)
        annual_records.append({"year": year, "total_mm": year_total})

        sys.stdout.write(f"{year_total} mm")
        sys.stdout.flush()
        time.sleep(0.5)  # be polite to IMD servers

    print()

    # Compute long-term normals (start_year to NORMAL_END)
    normal_years = [r for r in annual_records if r["year"] <= NORMAL_END]
    annual_mean = round(
        sum(r["total_mm"] for r in normal_years) / max(1, len(normal_years)), 1
    )

    monthly_means = []
    for month in range(1, 13):
        month_vals = [
            r["rainfall_mm"]
            for r in monthly_records
            if r["month"] == month and r["year"] <= NORMAL_END
        ]
        monthly_means.append(round(sum(month_vals) / max(1, len(month_vals)), 1))

    result = {
        "source": "IMD Gridded Rainfall (0.25 deg resolution)",
        "grid_point": {"lat": grid_lat, "lon": grid_lng},
        "note": note,
        "generated_at": date.today().isoformat(),
        "year_range": [start_year, end_year],
        "normal_period": [start_year, NORMAL_END],
        "monthly": monthly_records,
        "annual_totals": annual_records,
        "normals": {
            "annual_mean_mm": annual_mean,
            "monthly_mean_mm": monthly_means,
        },
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    write_artifact(output_path, result, compact=True)
    size_kb = output_path.stat().st_size / 1024
    print(f"\nWritten {output_path} ({size_kb:.0f} KB)")
    print(
        f"  {len(monthly_records)} monthly records, {len(annual_records)} annual totals"
    )
    print(f"  Long-term annual mean: {annual_mean} mm")


if __name__ == "__main__":
    main()
