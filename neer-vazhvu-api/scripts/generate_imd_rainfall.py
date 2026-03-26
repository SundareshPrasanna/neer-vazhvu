"""
Generate IMD historical rainfall JSON for Chennai.

Uses imdlib to download IMD's official gridded rainfall data (0.25° resolution),
extracts the nearest valid land grid point to Chennai, and writes monthly
aggregates to a static JSON file for the frontend.

Note: The exact Chennai grid point (13.0, 80.25) is classified as ocean by IMD.
We use (13.0, 80.0) which is ~30 km inland — still within the Chennai
metropolitan area (near Sriperumbudur). This is standard practice for
coastal stations in gridded datasets.

Usage:
    pip install imdlib xarray
    python generate_imd_rainfall.py

Output:
    ../../public/data/imd-rainfall-monthly.json
"""

import gc
import json
import sys
import tempfile
import time
from datetime import date
from pathlib import Path

import numpy as np

# IMD grid point (13.0, 80.0) — nearest valid land cell to Chennai
GRID_LAT = 13.0
GRID_LNG = 80.0
START_YEAR = 1970
END_YEAR = date.today().year - 1  # IMD archives lag ~1 year
OUTPUT_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "public"
    / "data"
    / "imd-rainfall-monthly.json"
)
NORMAL_END = 2020  # long-term normal computed over START_YEAR-NORMAL_END


def fetch_year(year: int) -> list[dict]:
    """Download one year, extract Chennai point, return monthly totals."""
    import imdlib as imd
    import pandas as pd

    with tempfile.TemporaryDirectory() as tmpdir:
        data = imd.get_data("rain", year, year, fn_format="yearwise", file_dir=tmpdir)
        ds = data.get_xarray()

    chennai = ds.sel(lat=GRID_LAT, lon=GRID_LNG, method="nearest")
    rain = chennai["rain"].values
    times = pd.to_datetime(chennai["time"].values)

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
    del ds, data, chennai, rain, times
    gc.collect()

    return months


def main() -> None:
    print(f"Downloading IMD rainfall data {START_YEAR}-{END_YEAR} (one year at a time)")
    print(f"Grid point: ({GRID_LAT}, {GRID_LNG})")

    monthly_records: list[dict] = []
    annual_records: list[dict] = []

    for year in range(START_YEAR, END_YEAR + 1):
        sys.stdout.write(f"\r  {year}... ")
        sys.stdout.flush()

        for attempt in range(3):
            try:
                months = fetch_year(year)
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

    # Compute long-term normals (START_YEAR to NORMAL_END)
    normal_years = [r for r in annual_records if r["year"] <= NORMAL_END]
    annual_mean = round(sum(r["total_mm"] for r in normal_years) / len(normal_years), 1)

    monthly_means = []
    for month in range(1, 13):
        month_vals = [
            r["rainfall_mm"]
            for r in monthly_records
            if r["month"] == month and r["year"] <= NORMAL_END
        ]
        monthly_means.append(round(sum(month_vals) / len(month_vals), 1))

    result = {
        "source": "IMD Gridded Rainfall (0.25 deg resolution)",
        "grid_point": {"lat": GRID_LAT, "lon": GRID_LNG},
        "note": "Nearest valid land grid point to Chennai"
        " (coastal cells classified as ocean by IMD)",
        "generated_at": date.today().isoformat(),
        "year_range": [START_YEAR, END_YEAR],
        "normal_period": [START_YEAR, NORMAL_END],
        "monthly": monthly_records,
        "annual_totals": annual_records,
        "normals": {
            "annual_mean_mm": annual_mean,
            "monthly_mean_mm": monthly_means,
        },
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(result, separators=(",", ":")))
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"\nWritten {OUTPUT_PATH} ({size_kb:.0f} KB)")
    print(
        f"  {len(monthly_records)} monthly records, {len(annual_records)} annual totals"
    )
    print(f"  Long-term annual mean: {annual_mean} mm")


if __name__ == "__main__":
    main()
