#!/usr/bin/env python3
"""Extract one district's water and land-use columns from the Census Village
Amenities XLSX.

This is deliberately a sibling of atlas_extract_census_village_amenities.py
rather than a widening of it. That script produces the identity columns the
tracked source extract is built from, and its output digest is referenced by
the crosswalk proposals. Payload columns therefore land in their own artifact,
joined back by Village Code, so identity and payload stay separable.

Only Python's standard library is used, and the worksheet is streamed because
the source workbook is large.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import posixpath
import re
import sys
import xml.etree.ElementTree as ET
import zipfile


IDENTITY_HEADERS = {
    "State Code": "stateCode",
    "District Code": "districtCode",
    "Village Code": "villageCode",
    "Village Name": "villageName",
    "Reference Year": "referenceYear",
}

MEASURE_HEADERS = {
    "Total Geographical Area (in Hectares)": "totalGeographicalAreaHectares",
    "Total Households": "totalHouseholds",
    "Total Population of Village": "totalPopulation",
    "Forest Area (in Hectares)": "forestAreaHectares",
    "Barren & Un-cultivable Land Area (in Hectares)": "barrenAreaHectares",
    "Culturable Waste Land Area (in Hectares)": "culturableWasteAreaHectares",
    "Net Area Sown (in Hectares)": "netAreaSownHectares",
    "Total Unirrigated Land Area (in Hectares)": "unirrigatedAreaHectares",
    "Area Irrigated by Source (in Hectares)": "irrigatedAreaHectares",
    "Canals Area (in Hectares)": "canalIrrigatedAreaHectares",
    "Wells/Tube Wells Area (in Hectares)": "wellIrrigatedAreaHectares",
    "Tanks/Lakes Area (in Hectares)": "tankIrrigatedAreaHectares",
    "Waterfall Area (in Hectares)": "waterfallIrrigatedAreaHectares",
    "Other Source (specify) Area (in Hectares)": "otherIrrigatedAreaHectares",
}

# Census encodes availability as 1 for available and 2 for not available.
STATUS_HEADERS = {
    "Tap Water-Treated (Status A(1)/NA(2))": "tapTreated",
    "Tap Water-Treated Functioning in Summer months (April-September) (Status A(1)/NA(2))": "tapTreatedSummer",
    "Tap Water Untreated (Status A(1)/NA(2))": "tapUntreated",
    "Tap Water Untreated Functioning in Summer months (April-September) (Status A(1)/NA(2))": "tapUntreatedSummer",
    "Covered Well (Status A(1)/NA(2))": "coveredWell",
    "Covered Well Functioning in Summer months (April-September) (Status A(1)/NA(2))": "coveredWellSummer",
    "Uncovered Well (Status A(1)/NA(2))": "uncoveredWell",
    "Uncovered Well Functioning in Summer months (April-September) (Status A(1)/NA(2))": "uncoveredWellSummer",
    "Hand Pump (Status A(1)/NA(2))": "handPump",
    "Hand Pump Functioning in Summer months (April-September) (Status A(1)/NA(2))": "handPumpSummer",
    "Tube Wells/Borehole (Status A(1)/NA(2))": "tubeWell",
    "Tube Wells/Borehole Functioning in Summer months (April-September) (Status A(1)/NA(2))": "tubeWellSummer",
    "River/Canal (Status A(1)/NA(2))": "riverCanal",
    "River/Canal Functioning in Summer months (April-September) (Status A(1)/NA(2))": "riverCanalSummer",
    "Tank/Pond/Lake (Status A(1)/NA(2))": "tankPondLake",
    "Tank/Pond/Lake Functioning in Summer months (April-September) (Status A(1)/NA(2))": "tankPondLakeSummer",
}

RELATIONSHIP_ID = (
    "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
)


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def normalize_header(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def column_index(cell_reference: str) -> int:
    match = re.match(r"([A-Z]+)", cell_reference)
    if not match:
        raise ValueError(f"Invalid cell reference: {cell_reference}")
    index = 0
    for character in match.group(1):
        index = index * 26 + (ord(character) - ord("A") + 1)
    return index - 1


def read_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    strings: list[str] = []
    with archive.open("xl/sharedStrings.xml") as source:
        for _event, element in ET.iterparse(source, events=("end",)):
            if local_name(element.tag) != "si":
                continue
            strings.append(
                "".join(
                    child.text or ""
                    for child in element.iter()
                    if local_name(child.tag) == "t"
                )
            )
            element.clear()
    return strings


def worksheet_path(archive: zipfile.ZipFile, sheet_name: str) -> str:
    with archive.open("xl/workbook.xml") as source:
        workbook = ET.parse(source).getroot()
    relationship_id = None
    for sheet in workbook.iter():
        if local_name(sheet.tag) == "sheet" and sheet.attrib.get("name") == sheet_name:
            relationship_id = sheet.attrib.get(RELATIONSHIP_ID)
            break
    if relationship_id is None:
        raise ValueError(f"Worksheet {sheet_name} is absent from the workbook")
    with archive.open("xl/_rels/workbook.xml.rels") as source:
        relationships = ET.parse(source).getroot()
    for relationship in relationships:
        if relationship.attrib.get("Id") == relationship_id:
            target = relationship.attrib.get("Target", "")
            return posixpath.normpath(posixpath.join("xl", target))
    raise ValueError(f"No relationship target for {sheet_name}")


def cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(
            child.text or "" for child in cell.iter() if local_name(child.tag) == "t"
        ).strip()
    value_element = next(
        (child for child in cell if local_name(child.tag) == "v"), None
    )
    if value_element is None or value_element.text is None:
        return ""
    raw = value_element.text
    if cell_type == "s":
        index = int(raw)
        if index >= len(shared_strings):
            raise ValueError(f"Shared-string index {index} is out of range")
        return shared_strings[index].strip()
    return raw.strip()


def to_number(raw: str) -> float | int | None:
    """Return an int for integral values.

    The digest is recomputed in TypeScript, where JSON.stringify writes 1143
    rather than 1143.0, so integral values must serialise the same way here or
    the artifact fails its own tamper check.
    """
    if raw == "":
        return None
    try:
        value = round(float(raw), 4)
    except ValueError:
        return None
    return int(value) if value.is_integer() else value


def to_status(raw: str) -> str:
    if raw == "1":
        return "available"
    if raw == "2":
        return "not-available"
    return "not-stated"


def extract(xlsx_path: str, district_code: str) -> list[dict]:
    wanted = {
        **{normalize_header(k): v for k, v in IDENTITY_HEADERS.items()},
        **{normalize_header(k): v for k, v in MEASURE_HEADERS.items()},
        **{normalize_header(k): v for k, v in STATUS_HEADERS.items()},
    }
    measures = set(MEASURE_HEADERS.values())
    statuses = set(STATUS_HEADERS.values())

    with zipfile.ZipFile(xlsx_path) as archive:
        shared_strings = read_shared_strings(archive)
        sheet_path = worksheet_path(archive, "Village_Data_3300")
        headers: dict[int, str] | None = None
        records: list[dict] = []
        with archive.open(sheet_path) as source:
            for _event, row in ET.iterparse(source, events=("end",)):
                if local_name(row.tag) != "row":
                    continue
                values: dict[int, str] = {}
                for cell in row:
                    if local_name(cell.tag) != "c":
                        continue
                    values[column_index(cell.attrib.get("r", ""))] = cell_value(
                        cell, shared_strings
                    )
                if headers is None:
                    seen: dict[str, int] = {}
                    headers = {}
                    for index, value in values.items():
                        key = normalize_header(value)
                        if key not in wanted:
                            continue
                        if key in seen:
                            raise ValueError(
                                f"Header {key!r} appears in columns {seen[key]} and {index}; "
                                "the column set must be unambiguous"
                            )
                        seen[key] = index
                        headers[index] = wanted[key]
                    missing = sorted(set(wanted.values()) - set(headers.values()))
                    if missing:
                        raise ValueError(
                            "Workbook is missing expected columns: "
                            + ", ".join(missing)
                        )
                    row.clear()
                    continue
                record = {
                    name: values.get(index, "").strip()
                    for index, name in headers.items()
                }
                if record.get("districtCode") != district_code:
                    row.clear()
                    continue
                output = {
                    "villageCode": record["villageCode"],
                    "villageName": record["villageName"],
                    "referenceYear": record["referenceYear"],
                }
                for key in sorted(measures):
                    output[key] = to_number(record.get(key, ""))
                output["drinkingWaterSources"] = {
                    key: to_status(record.get(key, "")) for key in sorted(statuses)
                }
                records.append(output)
                row.clear()
    records.sort(key=lambda item: item["villageCode"])
    return records


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workbook", required=True)
    parser.add_argument("--district-code", required=True)
    parser.add_argument("--plan-id", required=True)
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    records = extract(args.workbook, args.district_code)
    if not records:
        print(f"No village rows for district {args.district_code}", file=sys.stderr)
        return 1

    with open(args.workbook, "rb") as handle:
        snapshot = hashlib.sha256(handle.read()).hexdigest()

    payload = {
        "schemaVersion": 1,
        "planId": args.plan_id,
        "censusDistrictCode": args.district_code,
        "acquiredAt": args.as_of,
        "source": {
            "sourceId": "census-2011-dchb-village-amenities",
            "sourceUrl": args.source_url,
            "sourceAsOf": "Census 2011 release; village reference year 2009",
        },
        "snapshotSha256": snapshot,
        "recordsSha256": hashlib.sha256(
            json.dumps(records, separators=(",", ":")).encode("utf-8")
        ).hexdigest(),
        "recordCount": len(records),
        "records": records,
    }
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")
    print(
        f"Wrote {len(records)} village attribute rows for district "
        f"{args.district_code} to {args.out}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
