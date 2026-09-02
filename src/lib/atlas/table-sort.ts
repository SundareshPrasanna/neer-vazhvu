/**
 * Column sorting for the Atlas tables: the pure half. Both consumers - the
 * drop-in wrapper that enhances server-rendered tables and the directory
 * explorer's stateful table - classify and compare through these functions,
 * so "what does clicking this header do" has exactly one answer.
 *
 * Classification is per cell, and a column takes the majority kind of its
 * non-missing cells: a leading number reads as a number ("1,234 ha", "92.5%",
 * "148 d"), an ISO date as a date, anything else as text - so a category like
 * "over-exploited (5 of 12)" sorts alphabetically, not by the 5. Missing
 * readings ("not stated", em/en dashes, blanks) sink to the bottom whichever
 * direction the column is sorted, because "we don't know" is not a value.
 */

export type ColumnKind = "number" | "date" | "text";

export interface CellValue {
  missing: boolean;
  num: number | null;
  date: string | null;
  text: string;
}

const MISSING = /^(not stated|not projected|none|unstated|n\/a|—|–|-)?$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const LEADING_NUMBER = /^-?\d[\d,]*(\.\d+)?/;

export function cellSortValue(raw: string): CellValue {
  const text = raw.replace(/\s+/g, " ").trim();
  if (MISSING.test(text)) return { missing: true, num: null, date: null, text };
  if (ISO_DATE.test(text)) return { missing: false, num: null, date: text.slice(0, 10), text };
  const match = text.match(LEADING_NUMBER);
  if (match) return { missing: false, num: Number(match[0].replace(/,/g, "")), date: null, text };
  return { missing: false, num: null, date: null, text };
}

/** The kind most of the column's known cells agree on; text when nothing is known. */
export function columnKindOf(values: CellValue[]): ColumnKind {
  let numbers = 0;
  let dates = 0;
  let known = 0;
  for (const value of values) {
    if (value.missing) continue;
    known += 1;
    if (value.num !== null) numbers += 1;
    else if (value.date !== null) dates += 1;
  }
  if (known === 0) return "text";
  if (numbers * 2 > known) return "number";
  if (dates * 2 > known) return "date";
  return "text";
}

/** Compare for ascending order; the caller flips the sign for descending.
 *  Missing cells compare as "after everything", direction-independent. */
export function compareCells(a: CellValue, b: CellValue, kind: ColumnKind, descending: boolean): number {
  if (a.missing || b.missing) return a.missing === b.missing ? 0 : a.missing ? 1 : -1;
  const flip = descending ? -1 : 1;
  if (kind === "number") {
    const an = a.num ?? Number.NEGATIVE_INFINITY;
    const bn = b.num ?? Number.NEGATIVE_INFINITY;
    if (an !== bn) return flip * (an < bn ? -1 : 1);
    return flip * a.text.localeCompare(b.text, "en-IN");
  }
  if (kind === "date") {
    const ad = a.date ?? "";
    const bd = b.date ?? "";
    if (ad !== bd) return flip * ad.localeCompare(bd);
    return flip * a.text.localeCompare(b.text, "en-IN");
  }
  return flip * a.text.localeCompare(b.text, "en-IN", { sensitivity: "base", numeric: true });
}

/** The direction a column's FIRST click sorts: biggest first for readings,
 *  A to Z for names - the order a reader scanning for the worst case wants. */
export function firstClickDescending(kind: ColumnKind): boolean {
  return kind === "number" || kind === "date";
}
