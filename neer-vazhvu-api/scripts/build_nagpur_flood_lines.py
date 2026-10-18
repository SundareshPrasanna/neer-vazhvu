#!/usr/bin/env python3
"""
Nagpur's official red and blue flood-line sheets, as listed in Maharashtra
WRD's statewide register (public/data/flood-lines-nagpur.json).

The register (https://wrd.maharashtra.gov.in/Site/1315/Flood-Line-Maps)
describes every sheet in Marathi only and leaves the link text empty, which is
why English searches never found the Nag sheets. Rows were matched on the
Marathi descriptions (नाग नदी, पोरा नदी, कन्हान नदी ...) in the page saved on
2026-10-15. The four Nag sheets were opened: their title blocks give the RD
ranges below (NMC client, DRA Consultants; the three detailed sheets at
1:1,250, the combined sheet at 1:2,000), and their legends give
blue = 25-year and red = 100-year. The Pora sheet's legend says the same and
adds the observed flood line of 2018. Each Nag file was matched to its row by
its byte size (a one-byte ranged GET; this host answers HEAD with 404).

The sheets are scanned images with no coordinate file, so this lists and links
them; it draws nothing. Rendered by FloodLinesSection on the map variant.

Run:  python3 neer-vazhvu-api/scripts/build_nagpur_flood_lines.py
"""

import sys
from datetime import date
from pathlib import Path
from urllib.parse import quote

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

OUT = REPO_ROOT / "public" / "data" / "flood-lines-nagpur.json"
SOURCE_ID = "wrd-flood-line-maps"
REGISTER = "https://wrd.maharashtra.gov.in/Site/1315/Flood-Line-Maps"
PDF_BASE = "https://wrd.maharashtra.gov.in/Site/Upload/PDF/"

# Evidence pins: the register as read on this date. Only produced_at moves.
CHECKED_ON = "2026-10-15"
REGISTER_PDF_ROWS = 513  # rows carrying a PDF link (516 unique files)
# Selection rule: the entries for the Nag, Pora, Kanhan, Kolar, Vena and the
# Bagdor nalla around the city (RIVERS). The register's other Nagpur-district
# entries, not listed: register row -> river.
OTHER_DISTRICT_ROWS = {
    29: "Jam",
    187: "Nand",
    494: "Jam",
    495: "Wainganga",
    496: "Wainganga",
    497: "Wainganga",
}

# (register row, label, file name exactly as the register links it)
NAG = [
    (320, "Map 1: RD 0 to 3,550 m, the three sheets combined", "imgw-324194220.pdf"),
    (322, "Map 3: RD 0 to 1,710 m", "imgw-324194307.pdf"),
    (321, "Map 2: RD 1,710 to 2,040 m", "imgw-324194354.pdf"),
    (323, "Map 4: RD 2,040 to 3,550 m", "imgw-324194441 (1).pdf"),
]
# RD ranges read from the title blocks, in metres; the combined map spans them.
NAG_RD = {320: (0, 3550), 322: (0, 1710), 321: (1710, 2040), 323: (2040, 3550)}

RIVERS = [
    (
        "Nag river",
        "Inside NMC: the downstream 3.55 km at Pardi, Punapur and Bharatwada, "
        "surveyed for NMC at 1:1,250 (a combined sheet at 1:2,000)",
        NAG,
    ),
    (
        "Pora river (Narsala-Hudkeshwar)",
        "South-eastern edge of NMC: 5.3 km from Vihirgaon to Khedi, at 1:5,000, with the "
        "observed flood line of 2018",
        [
            (
                272,
                "Narsala-Hudkeshwar, Vihirgaon to Khedi, 5.3 km",
                "Narsala Hudkeshwar red line blue line map.pdf",
            )
        ],
    ),
    (
        "Kanhan river",
        "Outside NMC: Saoner taluka, and from Jilur village down to the Wainganga",
        [
            (53, "Kanhan river, Saoner taluka", "KANAN FLOOD LINE PDF.pdf"),
            (484, "Jilur village to the Bina confluence", "484.pdf"),
            (485, "Kolar-Kanhan confluence to the Wainganga confluence", "485.pdf"),
        ],
    ),
    (
        "Kolar river",
        "Outside NMC: Nagpur district; the Kolar joins the Kanhan",
        [
            # The register links these with a leading space (" map_scan_1.pdf"),
            # which answers 404; the files are served without it (checked
            # 2026-10-15; map 1's title block reads "Kolar river", VIDC, 1:5,000).
            (285, "Kolar river, map 1", "map_scan_1.pdf"),
            (286, "Kolar river, map 2", "map_scan_2 (1).pdf"),
        ],
    ),
    (
        "Vena river",
        "Outside NMC, west of the city: Hingna, Raipur and Kotewada",
        [
            (
                171,
                "Hingna 0 to 1.4 km and Raipur 0 to 1.5 km",
                "Hingana 0 to 4 Raipur 0 to 2 Km on Vena River Nagpur.pdf",
            ),
            (172, "Kotewada 0 to 2.2 km", "Kotewada red line blue line survey.pdf"),
        ],
    ),
    (
        "Bagdor nalla",
        "Outside NMC: Kamptee taluka, revised maps 1 to 6 in one file",
        [(444, "Bagdor nalla, revised maps 1 to 6", "BAGDOR NALLA -1-6 MAP.pdf")],
    ),
]


def check_nag() -> None:
    """The three Nag sheets must tile the combined map's RD range exactly."""
    parts = sorted(NAG_RD[row] for row in (322, 321, 323))
    assert parts[0][0] == NAG_RD[320][0] and parts[-1][1] == NAG_RD[320][1], parts
    for (_, end), (start, _) in zip(parts, parts[1:]):
        assert end == start, f"Nag sheets leave a gap or overlap at RD {end}/{start}"
    assert {row for row, _, _ in NAG} == set(NAG_RD), "a Nag row has no RD range"


def main() -> None:
    check_nag()
    rivers = [
        {
            "name": name,
            "context": context,
            "sheets": [
                {"label": label, "url": PDF_BASE + quote(fname), "register_row": row}
                for row, label, fname in sheets
            ],
        }
        for name, context, sheets in RIVERS
    ]
    n_sheets = sum(len(r["sheets"]) for r in rivers)
    # Nag 4, Pora 1, Kanhan 3, Kolar 2, Vena 2, Bagdor 1
    assert n_sheets == 13, n_sheets
    assert len({s["url"] for r in rivers for s in r["sheets"]}) == n_sheets

    by_river: dict[str, list[int]] = {}
    for row, river in sorted(OTHER_DISTRICT_ROWS.items()):
        by_river.setdefault(river, []).append(row)
    names = [
        f"the {river} (row{'s' if len(rows) > 1 else ''} {', '.join(map(str, rows))})"
        for river, rows in sorted(by_river.items(), key=lambda kv: kv[0] != "Wainganga")
    ]
    other = ", ".join(names[:-1]) + " and " + names[-1]
    payload = {
        "nvdm": "1.0",
        "dataset": "data-root/flood-lines",
        "scope": {"kind": "city", "id": "nagpur"},
        "provenance": {
            "sources": [
                {
                    "id": SOURCE_ID,
                    "title": (
                        "Maharashtra WRD Flood Line Maps (red and blue line sheets): "
                        f"{n_sheets} of {REGISTER_PDF_ROWS} statewide register entries, for "
                        "five rivers and a nalla in and around Nagpur"
                    ),
                    "publisher": "Water Resources Department, Government of Maharashtra",
                    "license": registry_license(SOURCE_ID),
                }
            ],
            "method": "manual",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_nagpur_flood_lines.py",
            "note": (
                "A list of the official sheets, matched on the register's Marathi "
                "descriptions; the sheets are scanned images and nothing here is "
                "digitised. register_row is the row number printed in the register."
            ),
        },
        "place_id": "nagpur",
        "updated": CHECKED_ON,
        "title": "Official flood lines (red and blue), Nagpur rivers",
        "intro": (
            "Maharashtra's Water Resources Department publishes the legal flood "
            "boundaries for rivers as 'red line and blue line' maps. On the Nag and "
            "Pora sheets the legend gives the blue line as the 25-year flood and the "
            "red line as the 100-year flood. The Nag sheets were prepared for the "
            "Nagpur Municipal Corporation and also print, for landmarks along "
            "the river, the 25-year and 100-year flood levels in metres. RD is the "
            "distance along the river in metres, counted downstream from Pardi. We "
            "link the official sheets; we do not redraw them."
        ),
        "source": {
            "label": f"WRD Maharashtra, Flood Line Maps ({REGISTER_PDF_ROWS} entries statewide)",
            "url": REGISTER,
        },
        "gaps_note": (
            "The register has no sheet for the Pili, and none for the Nag from "
            "Ambazari lake through the city centre: the four Nag sheets cover RD 0 "
            "to 3,550 m at the city's eastern edge. The Nag sheets carry no date in "
            "their title blocks. The sheets are scanned images with no digital line "
            "file (the Pora sheet prints a coordinate grid; the Nag sheets do not), so "
            "these lines are not drawn on any map here. The register's descriptions "
            "are in Marathi only. This list keeps the register's entries for the Nag, "
            "the Pora, the Kanhan, the Kolar, the Vena and the Bagdor nalla around the "
            "city; one entry can hold several maps (Bagdor nalla's holds six) or repeat "
            "others (Nag map 1 combines maps 2 to 4). The register also lists "
            f"Nagpur-district entries for {other}, which are not listed here."
        ),
        "rivers": rivers,
    }
    # write_artifact keeps an existing envelope: delete the file first if the
    # envelope above changes.
    write_artifact(OUT, payload)
    print(
        f"wrote {OUT.relative_to(REPO_ROOT)}: {len(rivers)} rivers, {n_sheets} sheets"
    )


if __name__ == "__main__":
    main()
