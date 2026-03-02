# Data Sources

> Where each dataset comes from, how often it refreshes, and what to watch out for.

## Reservoir Levels — CMWSSB

| | |
|---|---|
| **Source** | [Chennai Metropolitan Water Supply and Sewerage Board](https://cmwssb.tn.gov.in/lake-level) |
| **Method** | HTML scrape (BeautifulSoup) |
| **Frequency** | Daily (06:00 IST via GitHub Actions) |
| **Coverage** | 6 reservoirs: Poondi, Cholavaram, Red Hills, Chembarambakkam, Veeranam, Kannankottai |
| **Fields** | Water level (ft), storage (mcft), capacity (mcft), storage %, inflow (cusecs), outflow (cusecs), rainfall (mm) |
| **Table** | `reservoir_daily` |
| **Historical** | Kaggle dataset back to 2004 (monthly storage only); daily inflow/outflow available from ~2022 onward |

**Known limitations:**
- Page format changes without notice — scraper needs periodic updates
- Data may not update on weekends or public holidays
- Inflow/outflow fields were added later; pre-2022 records have nulls for these
- Occasional duplicate or stale rows when CMWSSB delays their update

## Weather — NASA POWER

| | |
|---|---|
| **Source** | [NASA POWER API](https://power.larc.nasa.gov/) (Prediction Of Worldwide Energy Resources) |
| **Method** | REST API (`/api/temporal/daily/point`) |
| **Frequency** | Daily (5-day backfill window, 2-day data lag) |
| **Coverage** | Single point: Chennai (13.0827°N, 80.2707°E) |
| **Fields** | Precipitation (mm), temperature max/min (°C), relative humidity (%) |
| **Table** | `weather_daily` |
| **Historical** | Available back to 1981 |

**Known limitations:**
- 2-day lag on data availability (today's weather appears day after tomorrow)
- Single point for all of Chennai — no ward-level granularity
- Satellite-derived precipitation can differ from ground-station readings
- Free tier has rate limits (undocumented but generally generous)

## Groundwater — OpenCity Chennai

| | |
|---|---|
| **Source** | [OpenCity Chennai](https://data.opencity.in/) (CKAN API) |
| **Method** | CKAN `datastore_search` API |
| **Frequency** | Monthly (pipeline runs days 1-3 of each month) |
| **Coverage** | ~200 wards across 15 zones in Greater Chennai Corporation |
| **Fields** | Ward number, ward name, zone, year, month, depth to water level (meters) |
| **Table** | `groundwater_monthly` |
| **Historical** | 2021–2024 datasets available (separate resource IDs per year) |

**Known limitations:**
- Data lags by several months (latest available may be 3-6 months old)
- Not all wards report every month — coverage varies
- Measurement methodology may differ across wards
- New year datasets require adding the resource ID to the scraper config

## Reservoir Metadata

| | |
|---|---|
| **Source** | Manually curated from CMWSSB and public records |
| **Table** | `reservoir_meta` |
| **Fields** | Display name, full capacity (mcft), latitude, longitude |

**Total system capacity:** 14,096 mcft across 6 reservoirs.

| Reservoir | Capacity (mcft) |
|-----------|----------------|
| Poondi | 3,231 |
| Cholavaram | 881 |
| Red Hills (Puzhal) | 3,300 |
| Chembarambakkam | 3,645 |
| Veeranam | 1,465 |
| Kannankottai (Thervoikandigai) | 1,574 |

## Historical Seeding

For initial database population, seed scripts in `scripts/` import from:

- **Kaggle** (`seed-kaggle.ts`) — Monthly reservoir storage 2004–2024
- **OpenCity** (`seed-opencity-groundwater.ts`) — Ward groundwater 2021–2024
- **OpenCity** (`seed-opencity-lakes.ts`) — Historical lake-level readings

These are one-time imports; daily pipeline keeps data current after seeding.
