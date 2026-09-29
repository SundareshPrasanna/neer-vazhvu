"""Read a spreadsheet printed to PDF back into rows keyed by a code column.

A sheet too wide for the page prints as tiles: every tile repeats the key
column (a station code) and carries a slice of the other columns. Word boxes
come from poppler (pdftotext -bbox). The key column sits under its header word
(or, without one, at the left edge). A tile's columns are placed from the rows
whose cell count is the tile's usual count; every row's words then go to the
column whose span holds them, and header words to the nearest column. A word
that falls between columns makes its row unreadable: the row is skipped and
reported, never guessed.
"""
from __future__ import annotations

import html
import re
import statistics
import subprocess
from pathlib import Path

WORD = re.compile(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>')
BDL = re.compile(r"\(?BDL\)?")


def pages(pdf: Path) -> list[list[tuple]]:
    """Words of each page as (xMin, yMin, xMax, yMax, text)."""
    out = subprocess.run(["pdftotext", "-bbox", str(pdf), "-"], capture_output=True, text=True, check=True).stdout
    return [[(float(a), float(b), float(c), float(d), html.unescape(t)) for a, b, c, d, t in WORD.findall(pg)]
            for pg in re.findall(r"<page[^>]*>(.*?)</page>", out, re.S)]


def _join_bdl(words: list[tuple]) -> list[tuple]:
    """A row's words left to right, with a detached "(BDL)" joined to the value before it."""
    out: list[tuple] = []
    for w in sorted(words):
        if out and BDL.fullmatch(w[4]) and w[0] - out[-1][2] < 8:
            p = out[-1]
            out[-1] = (p[0], p[1], w[2], p[3], p[4] + "(BDL)")
        else:
            out.append(w)
    return out


def _anchors(words: list[tuple], key: re.Pattern, header: str) -> list[tuple]:
    heads = [w for w in words if w[4] == header]
    if heads:
        h = min(heads, key=lambda w: w[1])
        return [w for w in words if key.fullmatch(w[4]) and w[0] < h[2] + 12 and w[2] > h[0] - 12 and w[1] > h[3]]
    left = min(w[0] for w in words)
    return [w for w in words if key.fullmatch(w[4]) and w[0] - left < 25]


def tile(words: list[tuple], key: re.Pattern, header: str = "STN") -> tuple[list[str], dict[str, list[str]], list[str]] | None:
    """(column labels, {key: cells}, skipped rows) for one tile, or None when the page has no key column."""
    if not words:
        return None
    anchors = _anchors(words, key, header)
    if len(anchors) < 2:
        return None
    anchors.sort(key=lambda a: a[1])
    height = statistics.median(a[3] - a[1] for a in anchors)
    top = min(a[1] for a in anchors)
    key_x = (min(a[0] for a in anchors) - 4, max(a[2] for a in anchors) + 4)
    body = sorted((w for w in words if w[3] > top - 1 and w[3] < anchors[-1][3] + height and not (key_x[0] < w[0] < key_x[1])),
                  key=lambda w: (w[1] + w[3]) / 2)
    lines: list[list[tuple]] = []
    for w in body:
        if lines and (w[1] + w[3]) / 2 - (lines[-1][-1][1] + lines[-1][-1][3]) / 2 < 0.45 * height:
            lines[-1].append(w)
        else:
            lines.append([w])
    # Some prints set the code a few points off its row, so each code takes the nearest value line within half the
    # row pitch, nearest pairs first, one line per code.
    mid = lambda w: (w[1] + w[3]) / 2  # noqa: E731
    pitch = statistics.median(mid(b) - mid(a) for a, b in zip(anchors, anchors[1:]))
    pairs = sorted((abs(mid(line[0]) - mid(a)), i, j) for i, a in enumerate(anchors) for j, line in enumerate(lines)
                   if abs(mid(line[0]) - mid(a)) < pitch / 2)
    rows, used = {}, set()
    for _, i, j in pairs:
        if anchors[i][4] not in rows and j not in used:
            rows[anchors[i][4]] = _join_bdl(lines[j])
            used.add(j)
    if not rows:
        return None
    n = statistics.mode(len(r) for r in rows.values())
    full = [r for r in rows.values() if len(r) == n]
    if not n:
        return None
    # Column spans from the usual rows (medians, so one shifted row cannot stretch them), widened by a third of the
    # gap to each neighbour. Every row is placed by position: a row with the usual count can still be shifted (a
    # two-word cell beside a blank one).
    spans = [(statistics.median(r[i][0] for r in full), statistics.median(r[i][2] for r in full)) for i in range(n)]
    centres = [(lo + hi) / 2 for lo, hi in spans]
    reach = [(spans[i][0] - ((spans[i][0] - spans[i - 1][1]) / 3 if i else 12),
              spans[i][1] + ((spans[i + 1][0] - spans[i][1]) / 3 if i + 1 < n else 12)) for i in range(n)]

    def column(w: tuple) -> int | None:
        x = (w[0] + w[2]) / 2
        inside = [i for i, (lo, hi) in enumerate(reach) if lo <= x <= hi]
        return inside[0] if len(inside) == 1 else None

    kept, skipped = {}, []
    for k, r in rows.items():
        cells: list[list[str]] = [[] for _ in range(n)]
        placed = [(column(w), w) for w in r]
        if any(i is None for i, _ in placed):
            skipped.append(f"{k} ({len(r)} cells, {n} expected)")
            continue
        for i, w in placed:
            cells[i].append(w[4])
        kept[k] = [" ".join(c) for c in cells]
    labels: list[list[str]] = [[] for _ in range(n)]
    for w in sorted((w for w in words if w[3] <= top - 1 and w[4] != header), key=lambda w: (round(w[1]), w[0])):
        overlap = [max(0.0, min(w[2], hi) - max(w[0], lo)) for lo, hi in spans]
        best = max(range(n), key=lambda i: overlap[i])
        labels[best if overlap[best] > 0 else min(range(n), key=lambda i: abs(centres[i] - (w[0] + w[2]) / 2))].append(w[4])
    return [" ".join(label) for label in labels], kept, skipped


def columns(pdf: Path, key: re.Pattern, wanted: dict[str, re.Pattern], header: str = "STN") -> tuple[dict[str, dict[str, str]], list[str]]:
    """{key: {name: cell}} for every wanted column. A name's pattern (tried on the label with its spaces taken
    out, since wrapped headers split words) must match exactly one column of a tile, and a column only one name;
    anything else is left out of that tile and noted, with the rows the tile skipped."""
    found: dict[str, dict[str, str]] = {}
    notes: list[str] = []
    for no, words in enumerate(pages(pdf), 1):
        read = tile(words, key, header)
        if not read:
            continue
        labels, rows, skipped = read
        compact = [re.sub(r"\s+", "", label) for label in labels]
        hits = {name: [i for i, label in enumerate(compact) if rx.search(label)] for name, rx in wanted.items()}
        hits = {name: i for name, i in hits.items() if i}
        claims: dict[int, list[str]] = {}
        for name, i in hits.items():
            if len(i) == 1:
                claims.setdefault(i[0], []).append(name)
            else:
                notes.append(f"page {no}: {name} matches {len(i)} columns, left out")
        for i, names in claims.items():
            if len(names) > 1:
                notes.append(f"page {no}: {' and '.join(names)} share a column ({labels[i]!r}), left out")
                continue
            for k, cells in rows.items():
                found.setdefault(k, {})[names[0]] = cells[i]
        if claims and skipped:
            notes.append(f"page {no}: skipped {', '.join(skipped)}")
    return found, notes
