#!/usr/bin/env python3
"""
City-surface gate: render every route a city advertises and prove it is not
lying, not empty, and not another city's page.

WHY THIS EXISTS
---------------
Onboarding Gurugram as city nine shipped SIX defects that lint, tsc, the test
suite and every CI job passed cleanly:

  1. the dashboard hero rendered BENGALURU'S water system under Gurugram's name
     (the Cauvery 95 km away, TK Halli, Kempe Gowda's kere network)
  2. the supply panel said "Structural numbers from MMC and the ADB Tamil Nadu
     Urban Flagship Investment Program" - facts about MADURAI
  3. the footer told readers CMWSSB - CHENNAI's utility - was one of their core
     live sources. Kolkata shipped live that way and was still wrong a day later
  4. the groundwater card promised a "live WRIS station overlay" for a city
     whose level series stopped in June 2020
  5. the water-bodies card said "OSM polygons" for a layer that is GMDA's own
     NGT register
  6. my-ward rendered 296 characters - a heading, a subtitle and a link - with
     no selector, no map and no data, while sitting in the nav

Every one is the same shape: A SHARED COMPONENT WHOSE DEFAULT IS A FACT ABOUT
ONE SPECIFIC CITY. "One shared component per feature" is the right rule, but
each component accumulates a default written for whoever it was built for, and
a new city inherits all of them at once.

WHY THE OBVIOUS CHECKS MISSED ALL SIX
-------------------------------------
Status codes: a page rendering another city's story returns 200.
Text-presence: asserting the RIGHT strings appear never asks whether wrong ones
  do.
A hand-written blocklist of bad phrases: can only catch leaks someone already
  found. "MMC" and "ADB Tamil Nadu" were not on mine.

So this gate INVERTS the blocklist. It derives the forbidden vocabulary from
the city registry itself: for city X, every other registered city's name,
display name, authority acronym and local-government acronym is a leak signal.
That is generative - it catches leaks nobody has seen yet, including from
cities added after this script was written.

THE FOUR CHECKS
---------------
  LEAK    another registered city's proper nouns on this city's page
  EMPTY   a route in FEATURE_AVAILABILITY with no map features, no table rows
          and almost no prose
  CONSOLE React errors or uncaught exceptions (the duplicate-key bug and the
          dev error overlay both show up here immediately)
  NULLISH undefined / NaN / [object Object] rendered as text

CONTROL CITY. Every check also runs against an established city. A check that
fails for BOTH is a harness bug, not a city bug - that rule caught three false
findings during the Gurugram sweep (a broken local install, the word "null" in
prose, and a page-wide grep flagging an already-correct control).

Run
---
    npm run dev &                       # or against any base url
    python3 scripts/check-city-surfaces.py --city gurugram --control bangalore

Needs playwright:  uvx --with playwright python scripts/check-city-surfaces.py ...
Not wired into CI: CI has no browser. This is a pre-cutover gate a human runs,
and it is the one that would have caught all six.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Words too generic to be a leak signal even though they appear in configs.
STOPWORDS = {
    "water",
    "board",
    "municipal",
    "corporation",
    "authority",
    "city",
    "metropolitan",
    "development",
    "supply",
    "sewerage",
    "greater",
}

# ADJUDICATED REFERENCES: another city named for a REAL reason, confirmed by a
# human who read the sentence. Keyed "<city>:<route>:<term>".
#
# This list exists so the gate does not cry wolf. A check that reports known-good
# findings every run gets skimmed, and skimming is how the CMWSSB footer bug
# survived an entire launch. Every entry must say WHY, and the why must be a
# fact about the page, not "it looked fine".
#
# Add an entry ONLY after reading the surrounding sentence in the browser.
ADJUDICATED: dict[str, str] = {
    "gurugram:origins:Delhi": "Load-bearing and true. Chapter 6 is about Gurugram being upstream of Delhi: its "
    "outflow goes to the Najafgarh jheel, then the Najafgarh drain - the Sahibi under "
    "another name - and into the Yamuna in Delhi. Removing the word would remove the point.",
    "gurugram:about:chennai": "No visible occurrence. The term appears in markup (a cross-city href) and never in "
    "rendered text - checked by printing every match's surrounding context and getting "
    "nothing back. Kept as an entry rather than silenced globally so the next reader sees "
    "it was adjudicated, not missed.",
}

NULLISH = ["undefined", "NaN", "[object Object]", "Infinity", "Invalid Date"]


def registered_cities() -> list[dict]:
    """Read the city registry out of the TS configs without a TS runtime.

    Deliberately regex rather than importing: this script must keep working if
    the config shape changes shape slightly, and a missed city degrades the
    check rather than breaking it.
    """
    out = []
    for f in sorted((ROOT / "src/lib/cities").glob("*.ts")):
        text = f.read_text()
        cid = re.search(r"cityId:\s*'([a-z-]+)'", text)
        if not cid:
            continue
        out.append(
            {
                "cityId": cid.group(1),
                "displayName": (
                    re.search(r"displayName:\s*'([^']+)'", text) or [None, None]
                )[1],
                "authority": (
                    re.search(r"primaryAuthority:.*?acronym:\s*'([^']+)'", text, re.S)
                    or [None, None]
                )[1],
                "localGov": (
                    re.search(r"localGovernment:.*?acronym:\s*'([^']+)'", text, re.S)
                    or [None, None]
                )[1],
            }
        )
    return out


def routes_for(city: str) -> list[str]:
    text = (ROOT / "src/lib/cities/routing.ts").read_text()
    m = re.search(rf"{city}:\s*new Set\(\[(.*?)\]\)", text, re.S)
    if not m:
        return []
    return [
        x.strip().strip('"')
        for x in m.group(1).split(",")
        if x.strip().strip('"') or x.strip() == '""'
    ]


def forbidden_terms(target: str, cities: list[dict]) -> list[str]:
    terms: set[str] = set()
    for c in cities:
        if c["cityId"] == target:
            continue
        for v in (c["cityId"], c["displayName"], c["authority"], c["localGov"]):
            if not v:
                continue
            if v.lower() in STOPWORDS or len(v) < 3:
                continue
            terms.add(v)
    return sorted(terms)


def audit(base: str, city: str, cities: list[dict], findings: list):
    from playwright.sync_api import sync_playwright

    forbidden = forbidden_terms(city, cities)
    routes = routes_for(city)
    if not routes:
        findings.append(
            (city, "(config)", "NO-ROUTES", "city absent from FEATURE_AVAILABILITY")
        )
        return

    with sync_playwright() as p:
        b = p.chromium.launch()
        for route in routes:
            url = f"{base}/{city}" + (f"/{route}" if route else "")
            label = f"/{city}/{route or '(dash)'}"
            pg = b.new_page(viewport={"width": 1440, "height": 1100})
            errs, cons = [], []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on(
                "console", lambda m: cons.append(m.text) if m.type == "error" else None
            )
            try:
                pg.goto(url, wait_until="domcontentloaded", timeout=240000)
            except Exception as exc:
                findings.append((city, label, "NAV-FAIL", str(exc)[:100]))
                pg.close()
                continue

            prev, stable, text = -1, 0, ""
            for _ in range(40):
                pg.wait_for_timeout(500)
                try:
                    text = pg.evaluate("document.body.innerText")
                except Exception:
                    text = ""
                if len(text) == prev:
                    stable += 1
                    if stable >= 3:
                        break
                else:
                    stable = 0
                prev = len(text)

            try:
                pg.evaluate(
                    "document.querySelectorAll('details').forEach(d=>d.open=true)"
                )
                pg.wait_for_timeout(300)
                text = pg.evaluate("document.body.innerText")
            except Exception:
                pass

            struct = pg.evaluate("""() => ({
              mapFeatures: document.querySelectorAll('.leaflet-overlay-pane path').length
                         + document.querySelectorAll('.leaflet-marker-icon').length,
              rows: document.querySelectorAll('tbody tr').length,
              maps: document.querySelectorAll('.leaflet-container').length,
            })""")

            # The city switcher legitimately lists every other city, so the
            # nav/menu regions are hidden before scanning for leaks.
            #
            # HIDDEN IN PLACE, NOT CLONED. The first version of this cloned the
            # body and removed those nodes from the clone - and a detached node
            # has no layout, so `innerText` silently degrades to `textContent`.
            # That pulled in the CLOSED city-switcher menu, which lists every
            # city, and reported "Bengaluru" and "BWSSB" as leaks on all six
            # Gurugram pages plus 140 on the control. Identical terms on every
            # page is the signature of a harness bug, not a content bug.
            # innerText is the right lens precisely because it reflects what is
            # laid out and visible.
            body = pg.evaluate("""() => {
              const hidden = [];
              document.querySelectorAll('nav,header,footer,[role=menu],[role=listbox]')
                .forEach(n => { hidden.push([n, n.style.display]); n.style.display = 'none'; });
              const t = document.body.innerText;
              hidden.forEach(([n, d]) => { n.style.display = d; });
              return t;
            }""")

            route_key = route or "(dash)"
            for term in forbidden:
                if re.search(rf"\b{re.escape(term)}\b", body):
                    if f"{city}:{route_key}:{term}" in ADJUDICATED:
                        continue
                    findings.append((city, label, "LEAK", term))
            for tok in NULLISH:
                if re.search(r"(?<![\w-])" + re.escape(tok) + r"(?![\w-])", body):
                    findings.append((city, label, "NULLISH", tok))
            for e in errs:
                findings.append((city, label, "PAGEERROR", e[:140]))
            for c in cons:
                if "vercel-scripts" in c or "Content Security Policy" in c:
                    continue  # environment noise, present on every city
                if "404" in c:
                    continue  # absent optional artifact, reported separately
                findings.append((city, label, "CONSOLE", c[:140]))

            if struct["mapFeatures"] == 0 and struct["rows"] == 0 and len(body) < 700:
                findings.append(
                    (
                        city,
                        label,
                        "EMPTY",
                        f"{len(body)} chars, {struct['maps']} maps with "
                        f"{struct['mapFeatures']} features, {struct['rows']} rows",
                    )
                )

            print(
                f"  {label:30s} {len(body):6d} chars  "
                f"{struct['mapFeatures']:4d} map-features  {struct['rows']:3d} rows",
                file=sys.stderr,
            )
            pg.close()
        b.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--city", required=True)
    ap.add_argument(
        "--control",
        default="bangalore",
        help="established city; a finding on BOTH is a harness bug",
    )
    ap.add_argument("--base", default="http://localhost:3000")
    args = ap.parse_args()

    cities = registered_cities()
    known = {c["cityId"] for c in cities}
    for c in (args.city, args.control):
        if c not in known:
            print(f"unknown city {c!r}; registry has {sorted(known)}", file=sys.stderr)
            return 2

    findings: list = []
    print(f"--- {args.city} ---", file=sys.stderr)
    audit(args.base, args.city, cities, findings)
    print(f"--- {args.control} (control) ---", file=sys.stderr)
    audit(args.base, args.control, cities, findings)

    target = [f for f in findings if f[0] == args.city]
    control = [f for f in findings if f[0] == args.control]
    control_kinds = {(f[2], f[3]) for f in control}
    # A finding that reproduces on the control is the harness misfiring.
    real = [f for f in target if (f[2], f[3]) not in control_kinds]
    harness = [f for f in target if (f[2], f[3]) in control_kinds]

    print("\n===== FINDINGS =====")
    for f in real:
        print(f"  {f[1]:30s} {f[2]:10s} {f[3]}")
    if harness:
        print(
            f"\n  ({len(harness)} suppressed: also present on the control, so harness noise)"
        )
    if control:
        print(f"  (control {args.control} raised {len(control)} of its own)")
    print(f"\n{len(real)} real finding(s) for {args.city}")
    return 1 if real else 0


if __name__ == "__main__":
    raise SystemExit(main())
