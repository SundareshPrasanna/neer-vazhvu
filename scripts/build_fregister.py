#!/usr/bin/env python3
"""Reproducible extraction of KSPCB F-register (consented-industry) counts for the
Arkavathi basin, per Regional Office / taluk, coloured by pollution category.

The F-register is published as scanned PDFs whose table layout drifts between ROs
(colour appears as a single letter, a full word, or only as the leading letter of
the XGN category code). We derive colour from THREE signals in priority order:
  1) an explicit full-word colour cell (Red/Orange/Green/White),
  2) the leading letter of the XGN category code (R-44, O1324, G55, ...),
  3) a per-file-detected single-letter colour column.
Totals count every data row (F.No is an integer) after de-duping by (name,address).

Counts are APPROXIMATE - OCR from scanned 2019 registers. Emits an aggregates JSON;
does not write into the app data (the numbers are transcribed into gaps.json /
prs.json by hand, rounded + caveated). Requires: pdfplumber. Sources: fregister-sources.json.

Usage:  python3 scripts/build_fregister.py [--out aggregates.json]
"""
import argparse, collections, json, os, re, subprocess, sys, tempfile, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = json.load(open(os.path.join(HERE, "fregister-sources.json")))
COLNORM = {"R": "Red", "O": "Orange", "G": "Green", "W": "White"}
FULLWORD = {"RED": "Red", "ORANGE": "Orange", "GREEN": "Green", "WHITE": "White"}
CODE_RE = re.compile(r"^([ROGW])[-\s]?\d", re.I)


def norm(s):
    return re.sub(r"\s+", "", (s or "").lower())


def fetch(url, dest):
    if os.path.exists(dest):
        return
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    import ssl
    ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, context=ctx, timeout=120) as r, open(dest, "wb") as f:
        f.write(r.read())


def detect_letter_col(rows):
    counts, distinct = collections.Counter(), collections.defaultdict(set)
    for c in rows:
        for i, x in enumerate(c):
            u = (x or "").strip().upper()
            if u in ("R", "O", "G", "W"):
                counts[i] += 1
                if u != "O":
                    distinct[i].add(u)
    cand = [i for i in counts if len(distinct[i]) >= 2]
    return max(cand, key=lambda i: counts[i]) if cand else None


def colour(cells, lc):
    for x in cells:
        u = (x or "").strip().upper()
        if u in FULLWORD:
            return FULLWORD[u]
    for x in cells:
        m = CODE_RE.match((x or "").strip())
        if m:
            return COLNORM[m.group(1).upper()]
    if lc is not None and lc < len(cells):
        u = (cells[lc] or "").strip().upper()
        if u in COLNORM:
            return COLNORM[u]
    return None


def load_rows(paths):
    import pdfplumber
    seen, rows = set(), []
    for path in paths:
        pdf = pdfplumber.open(path)
        for p in pdf.pages:
            t = p.extract_table()
            if not t:
                continue
            for r in t:
                c = [(x or "").replace("\n", " ").strip() for x in r]
                if len(c) < 7 or not re.fullmatch(r"\d+", c[0] or ""):
                    continue
                key = (norm(c[3]) if len(c) > 3 else "", norm(c[4]) if len(c) > 4 else "")
                if not key[0] or key in seen:
                    continue
                seen.add(key)
                rows.append(c)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "..", "docs", "partnerships",
                    "paani_partnership", "kspcb-fregister-basin-final.json"))
    ap.add_argument("--cache", default=os.path.join(tempfile.gettempdir(), "kspcb_freg"))
    args = ap.parse_args()
    try:
        import pdfplumber  # noqa
    except ImportError:
        sys.exit("pip install pdfplumber")
    os.makedirs(args.cache, exist_ok=True)
    out = {}
    for ro, meta in SRC["regional_offices"].items():
        if not meta.get("basin"):
            continue
        paths = []
        for fn in meta["files"]:
            dest = os.path.join(args.cache, fn)
            fetch(SRC["base_url"] + fn.replace(" ", "%20"), dest)
            paths.append(dest)
        rows = load_rows(paths)
        lc = detect_letter_col(rows)
        tot = collections.Counter()
        per = collections.defaultdict(lambda: collections.Counter())
        for c in rows:
            tot["_total"] += 1
            col = colour(c, lc)
            tot[col or "_unclassified"] += 1
            tk = norm(c[6]) if len(c) > 6 else ""
            per[tk]["_total"] += 1
            if col in ("Red", "Orange"):
                per[tk]["_ro"] += 1
        out[ro] = {k: tot[k] for k in ("_total", "Red", "Orange", "Green", "White", "_unclassified")}
        if ro == "Ramanagara":
            out["_ramanagara_taluks"] = {tk: {"total": v["_total"], "ro": v["_ro"]}
                                         for tk, v in per.items() if v["_total"] >= 20}
        print(f"{ro:15s} total={tot['_total']:5d} R={tot['Red']:4d} O={tot['Orange']:4d} "
              f"G={tot['Green']:4d} W={tot['White']:4d} unclass={tot['_unclassified']:4d}")
    json.dump(out, open(args.out, "w"), indent=1)
    gt = sum(out[r]["_total"] for r in out if not r.startswith("_"))
    gro = sum(out[r]["Red"] + out[r]["Orange"] for r in out if not r.startswith("_"))
    print(f"\nBASIN total={gt}  R+O={gro} ({round(100 * gro / gt)}%)  -> {args.out}")


if __name__ == "__main__":
    main()
