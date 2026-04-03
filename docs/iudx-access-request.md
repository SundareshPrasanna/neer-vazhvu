# IUDX Data Access Request - Neer Vazhvu

**Date:** April 2, 2026
**Applicant:** Sundaresh Prasanna Chandran
**Email:** sundareshchandran@gmail.com

---

## Project: Neer Vazhvu - Chennai Water Intelligence Dashboard

**Website:** https://neer-vazhvu.vercel.app
**Source Code:** https://github.com/SundareshPrasanna/neer-vazhvu (open-source, MIT license)

### Project Overview

Neer Vazhvu is an open-source civic dashboard that visualizes Chennai's water infrastructure - reservoirs, groundwater, rivers, flood risk, and water bodies - to help citizens, journalists, and policymakers understand the city's water health.

The platform currently integrates data from CPCB (river water quality), CGWB/India WRIS (groundwater), IMD (rainfall), NASA POWER (climate), OpenStreetMap (water body geometry), and OpenCity Chennai (flood hazard zones).

### Requested Dataset

**Flood Level Alerts from Flood Monitoring Systems in Chennai City**
Resource Group ID: 257aab1b-1258-445a-a37e-058486a2fa13

### Purpose of Use

We intend to integrate real-time water level sensor readings into the existing flood risk map on our dashboard. Specifically:

1. **Flood risk visualization** - Overlay live canal, subway, and river water levels on the flood hazard map so citizens can see current waterlogging conditions in their area.

2. **Subway/underpass safety** - Surface real-time water levels at 27 subway sensors to warn commuters about flooded underpasses during rain events.

3. **Lake and canal monitoring** - Display current water levels alongside historical flood zone data to provide context during monsoon season.

### How the Data Will Be Used

- Data will be fetched via the IUDX Resource Server API and cached for 5 minutes server-side.
- Sensor readings will be displayed as map markers color-coded by water level severity (normal/warning/danger).
- All data will be attributed to "IUDX / Chennai Smart City" on the dashboard.
- No data will be stored permanently or redistributed - only real-time display.
- The dashboard is freely accessible to the public with no login required.

### Impact

Chennai faces recurring urban flooding (2015, 2023, 2024 Cyclone Michaung). Real-time water level data, combined with our existing flood hazard zones and drainage network maps, can help citizens make informed decisions during rain events - which roads to avoid, which subways are flooding, and which areas are at immediate risk.

### Duration

12 months (with renewal request if continued access is needed).

---

**Sundaresh Prasanna Chandran**
sundareshchandran@gmail.com
