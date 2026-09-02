"use client";

/**
 * Drop-in replacement for AtlasTableScroll that makes the table inside it
 * sortable by its columns. The table stays server-rendered exactly as it
 * was - links, badges and all; this wrapper finds it after hydration, turns
 * the header cells of the LAST thead row into buttons, and reorders the
 * existing tbody rows in place on click. No React state is involved: the
 * children are static server output that React never re-renders, so the DOM
 * is ours to reorder, and without JavaScript the table simply stays in its
 * served order.
 *
 * Rows that do not span the full column set (a "none counted" note under a
 * colSpan) keep their place at the bottom, unsorted. A thead whose last row
 * itself uses colSpan is left untouched: there is no honest cell-to-column
 * mapping to sort by.
 */
import { useEffect, useRef, type ReactNode } from "react";

import {
  cellSortValue,
  columnKindOf,
  compareCells,
  firstClickDescending,
  type CellValue,
} from "@/lib/atlas/table-sort";

const BUTTON_CLASSES = [
  "inline-flex", "items-center", "gap-1", "cursor-pointer", "select-none",
  "text-left", "font-semibold", "hover:text-slate-900", "dark:hover:text-slate-100",
  "focus-visible:outline", "focus-visible:outline-2", "focus-visible:outline-cyan-600",
];
const ARROW_CLASSES = ["text-[10px]", "leading-none", "text-slate-400", "dark:text-slate-500"];

function enhance(container: HTMLDivElement): void {
  const table = container.querySelector("table");
  const head = table?.tHead;
  const body = table?.tBodies[0];
  if (!table || !head || !body || head.rows.length === 0) return;
  const headerRow = head.rows[head.rows.length - 1];
  const headers = Array.from(headerRow.cells);
  if (headers.some((cell) => cell.colSpan > 1)) return;

  let sortedBy = -1;
  let descending = false;
  const arrows: HTMLElement[] = [];

  const sortBy = (column: number): void => {
    const rows = Array.from(body.rows);
    const sortable = rows.filter((row) => row.cells.length === headers.length);
    const remainder = rows.filter((row) => row.cells.length !== headers.length);
    const valueOf = (row: HTMLTableRowElement): CellValue =>
      cellSortValue(row.cells[column].dataset.sort ?? row.cells[column].textContent ?? "");
    const values = new Map(sortable.map((row) => [row, valueOf(row)]));
    const kind = columnKindOf([...values.values()]);
    descending = sortedBy === column ? !descending : firstClickDescending(kind);
    sortedBy = column;
    sortable.sort((a, b) => compareCells(values.get(a)!, values.get(b)!, kind, descending));
    for (const row of [...sortable, ...remainder]) body.appendChild(row);
    headers.forEach((cell, index) => {
      if (index === column) cell.setAttribute("aria-sort", descending ? "descending" : "ascending");
      else cell.removeAttribute("aria-sort");
      arrows[index].textContent = index === column ? (descending ? "▼" : "▲") : "↕";
    });
  };

  headers.forEach((cell, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.add(...BUTTON_CLASSES);
    while (cell.firstChild) button.appendChild(cell.firstChild);
    const arrow = document.createElement("span");
    arrow.classList.add(...ARROW_CLASSES);
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↕";
    arrows.push(arrow);
    button.appendChild(arrow);
    button.addEventListener("click", () => sortBy(index));
    cell.appendChild(button);
  });
}

export function AtlasSortableTable({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = ref.current;
    if (container && container.dataset.sortable !== "done") {
      container.dataset.sortable = "done";
      enhance(container);
    }
  }, []);
  return (
    <div
      ref={ref}
      className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
