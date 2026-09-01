#!/usr/bin/env python3
"""Extract one district's identity columns from the Census Village Amenities XLSX.

This intentionally uses only Python's standard library. The source workbook is
large (~212 MB uncompressed), so the worksheet is streamed instead of loaded
into an in-memory spreadsheet model.
"""

from __future__ import annotations

import argparse
import json
import posixpath
import re
import sys
import xml.etree.ElementTree as ET
import zipfile


RELATIONSHIP_ID = (
    "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
)
DEFAULT_SHEET = "Village_Data_3300"
REQUIRED_HEADERS = {
    "State Code": "stateCode",
    "State Name": "stateName",
    "District Code": "districtCode",
    "District Name": "districtName",
    "Sub District Code": "subdistrictCode",
    "Sub District Name": "subdistrictName",
    "Village Code": "villageCode",
    "Village Name": "villageName",
    "CD Block Code": "cdBlockCode",
    "CD Block Name": "cdBlockName",
    "Gram Panchayat Code": "gramPanchayatCode",
    "Gram Panchayat Name": "gramPanchayatName",
    "Reference Year": "referenceYear",
}


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def column_index(cell_reference: str) -> int:
    match = re.match(r"([A-Z]+)", cell_reference)
    if not match:
        raise ValueError(f"Invalid cell reference: {cell_reference}")
    value = 0
    for char in match.group(1):
        value = value * 26 + ord(char) - ord("A") + 1
    return value


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
    workbook = ET.parse(archive.open("xl/workbook.xml")).getroot()
    relationship_id = None
    for element in workbook.iter():
        if (
            local_name(element.tag) == "sheet"
            and element.attrib.get("name") == sheet_name
        ):
            relationship_id = element.attrib.get(RELATIONSHIP_ID)
            break
    if not relationship_id:
        raise ValueError(f"Workbook does not contain sheet {sheet_name!r}")

    relationships = ET.parse(archive.open("xl/_rels/workbook.xml.rels")).getroot()
    for element in relationships:
        if element.attrib.get("Id") != relationship_id:
            continue
        target = element.attrib.get("Target", "")
        if target.startswith("/"):
            return target.lstrip("/")
        return posixpath.normpath(posixpath.join("xl", target))
    raise ValueError(f"Workbook relationship {relationship_id!r} is missing")


def cell_value(
    cell: ET.Element,
    shared_strings: list[str],
) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(
            child.text or "" for child in cell.iter() if local_name(child.tag) == "t"
        ).strip()
    value_element = next(
        (child for child in cell if local_name(child.tag) == "v"),
        None,
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


def paired_values(
    record: dict[str, str],
    code_key: str,
    name_key: str,
) -> list[dict[str, str]]:
    codes = [value.strip() for value in record[code_key].split(",") if value.strip()]
    names = [value.strip() for value in record[name_key].split(",") if value.strip()]
    if len(codes) != len(names):
        raise ValueError(
            f"Census row {record.get('villageCode', '?')} has "
            f"{len(codes)} {code_key} values but {len(names)} {name_key} values"
        )
    return [
        {"code": code, "name": name} for code, name in zip(codes, names, strict=True)
    ]


def extract_records(
    xlsx_path: str,
    district_code: str,
    sheet_name: str = DEFAULT_SHEET,
    allow_empty_gram_panchayat: bool = False,
    subdistrict_codes: set[str] | None = None,
) -> list[dict[str, str | list[dict[str, str]]]]:
    with zipfile.ZipFile(xlsx_path) as archive:
        shared_strings = read_shared_strings(archive)
        sheet_path = worksheet_path(archive, sheet_name)
        headers: dict[int, str] | None = None
        records: list[dict[str, str | list[dict[str, str]]]] = []
        with archive.open(sheet_path) as source:
            for _event, row in ET.iterparse(source, events=("end",)):
                if local_name(row.tag) != "row":
                    continue
                values: dict[int, str] = {}
                for cell in row:
                    if local_name(cell.tag) != "c":
                        continue
                    index = column_index(cell.attrib.get("r", ""))
                    if index <= 13:
                        values[index] = cell_value(cell, shared_strings)
                if headers is None:
                    headers = {
                        index: REQUIRED_HEADERS[value]
                        for index, value in values.items()
                        if value in REQUIRED_HEADERS
                    }
                    missing = sorted(
                        set(REQUIRED_HEADERS.values()) - set(headers.values())
                    )
                    if missing:
                        raise ValueError(
                            f"{sheet_name} is missing required identity columns: "
                            + ", ".join(missing)
                        )
                else:
                    raw_record = {
                        output_name: values.get(index, "").strip()
                        for index, output_name in headers.items()
                    }
                    if raw_record.get("districtCode") == district_code and (
                        not subdistrict_codes
                        or raw_record.get("subdistrictCode") in subdistrict_codes
                    ):
                        optional = (
                            {"gramPanchayatCode", "gramPanchayatName"}
                            if allow_empty_gram_panchayat
                            else set()
                        )
                        if not all(
                            value
                            for name, value in raw_record.items()
                            if name not in optional
                        ):
                            missing = sorted(
                                name for name, value in raw_record.items() if not value
                            )
                            raise ValueError(
                                "Census identity row has empty required values: "
                                + ", ".join(missing)
                            )
                        record: dict[str, str | list[dict[str, str]]] = {
                            key: value
                            for key, value in raw_record.items()
                            if key
                            not in {
                                "cdBlockCode",
                                "cdBlockName",
                                "gramPanchayatCode",
                                "gramPanchayatName",
                            }
                        }
                        record["cdBlocks"] = paired_values(
                            raw_record,
                            "cdBlockCode",
                            "cdBlockName",
                        )
                        record["gramPanchayats"] = paired_values(
                            raw_record,
                            "gramPanchayatCode",
                            "gramPanchayatName",
                        )
                        records.append(record)
                row.clear()
    if not records:
        scope = f"district {district_code}"
        if subdistrict_codes:
            scope += f" subdistricts {', '.join(sorted(subdistrict_codes))}"
        raise ValueError(f"No Census village rows found for {scope}")
    records.sort(key=lambda record: int(str(record["villageCode"])))
    village_codes = [record["villageCode"] for record in records]
    if len(set(village_codes)) != len(village_codes):
        raise ValueError("Census extract contains duplicate village codes")
    return records


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xlsx", required=True)
    parser.add_argument("--district-code", required=True)
    parser.add_argument(
        "--sheet",
        default=DEFAULT_SHEET,
        help="worksheet name; the state release number is in it (Village_Data_3300 for Tamil Nadu, Village_Data_2700 for Maharashtra)",
    )
    parser.add_argument(
        "--allow-empty-gram-panchayat",
        action="store_true",
        help="accept rows with no Gram Panchayat code/name (the Maharashtra release leaves the column blank; composition then comes from the LGD register, not from the Census)",
    )
    parser.add_argument(
        "--subdistrict-codes",
        default="",
        help="comma-separated Census subdistrict codes to keep: the taluks of a district formed after 2011, whose rows sit under the parent district's code (Tirupathur under Vellore)",
    )
    args = parser.parse_args()
    subdistrict_codes = {
        code.strip() for code in args.subdistrict_codes.split(",") if code.strip()
    }
    try:
        json.dump(
            extract_records(
                args.xlsx,
                args.district_code,
                sheet_name=args.sheet,
                allow_empty_gram_panchayat=args.allow_empty_gram_panchayat,
                subdistrict_codes=subdistrict_codes or None,
            ),
            sys.stdout,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        sys.stdout.write("\n")
        return 0
    except (OSError, ValueError, zipfile.BadZipFile) as error:
        print(str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
