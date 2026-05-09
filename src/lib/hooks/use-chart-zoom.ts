"use client";

import { useMemo, useRef, useState, useCallback } from "react";

/**
 * Shared chart-zoom logic: drag-to-select on desktop, pinch-to-zoom on
 * mobile, double-click to reset. Returns state, refs, and event
 * handlers a chart wrapper can spread onto a container <div>, plus
 * a function to filter the chart's data rows to the current zoom
 * window.
 *
 * The chart component is responsible for rendering the selection
 * overlay (we expose dragRange + isZoomed + a Reset button onClick).
 *
 * Why a hook: the same UX is needed on the multi-source per-city home
 * chart and on Chennai's combined-totals chart. Extracting here keeps
 * both call sites identical.
 */

const ONE_WEEK_MS = 86400 * 1000 * 7;

export interface UseChartZoomOptions<T> {
  /** Sorted-ascending data rows. Each row must carry a date the
   *  toMillis function can convert. */
  rows: T[];
  /** Pull the millisecond timestamp from a row. */
  toMillis: (row: T) => number;
  /** Minimum zoom span in ms. Default: 1 week. */
  minSpanMs?: number;
}

export interface UseChartZoomReturn<T> {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isZoomed: boolean;
  visibleRows: T[];
  dragRange: { startX: number; currentX: number } | null;
  resetZoom: () => void;
  /** Spread onto the chart container <div>. */
  handlers: {
    onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
    onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
    onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void;
    onTouchEnd: () => void;
    onDoubleClick: () => void;
  };
}

export function useChartZoom<T>({
  rows,
  toMillis,
  minSpanMs = ONE_WEEK_MS,
}: UseChartZoomOptions<T>): UseChartZoomReturn<T> {
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const [dragRange, setDragRange] = useState<{ startX: number; currentX: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pinchStateRef = useRef<{
    initialDistance: number;
    initialDomain: [number, number];
    centerMs: number;
  } | null>(null);

  const dataRange = useMemo<[number, number] | null>(() => {
    if (rows.length === 0) return null;
    const first = toMillis(rows[0]);
    const last = toMillis(rows[rows.length - 1]);
    return [first, last];
  }, [rows, toMillis]);

  const visibleRows = useMemo(() => {
    if (!zoomDomain || rows.length === 0) return rows;
    const [lo, hi] = zoomDomain;
    return rows.filter((r) => {
      const t = toMillis(r);
      return t >= lo && t <= hi;
    });
  }, [rows, zoomDomain, toMillis]);

  const resetZoom = useCallback(() => setZoomDomain(null), []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current || !dataRange) return;
      if (e.button !== 0) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setDragRange({ startX: x, currentX: x });
    },
    [dataRange],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragRange || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      setDragRange((prev) => (prev ? { ...prev, currentX: x } : prev));
    },
    [dragRange],
  );

  const onMouseUp = useCallback(() => {
    if (!dragRange || !containerRef.current || !dataRange) {
      setDragRange(null);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const x1 = Math.min(dragRange.startX, dragRange.currentX);
    const x2 = Math.max(dragRange.startX, dragRange.currentX);
    const dragWidth = x2 - x1;
    setDragRange(null);
    if (dragWidth < 8) return; // ignore tiny drags so a click doesn't zoom
    const current = zoomDomain ?? dataRange;
    const span = current[1] - current[0];
    const newLo = current[0] + (x1 / rect.width) * span;
    const newHi = current[0] + (x2 / rect.width) * span;
    if (newHi - newLo < minSpanMs) return;
    setZoomDomain([Math.max(dataRange[0], newLo), Math.min(dataRange[1], newHi)]);
  }, [dragRange, dataRange, zoomDomain, minSpanMs]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length !== 2 || !containerRef.current || !dataRange) return;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const fraction = Math.max(0, Math.min(1, centerX / rect.width));
      const current = zoomDomain ?? dataRange;
      const span = current[1] - current[0];
      pinchStateRef.current = {
        initialDistance: distance,
        initialDomain: current,
        centerMs: current[0] + span * fraction,
      };
    },
    [dataRange, zoomDomain],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length !== 2 || !pinchStateRef.current || !dataRange) return;
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const { initialDistance, initialDomain, centerMs } = pinchStateRef.current;
      if (initialDistance < 4) return;
      const scale = initialDistance / distance;
      const initialSpan = initialDomain[1] - initialDomain[0];
      const newSpan = Math.max(minSpanMs, Math.min(dataRange[1] - dataRange[0], initialSpan * scale));
      const fraction = (centerMs - initialDomain[0]) / initialSpan;
      let newLo = centerMs - newSpan * fraction;
      let newHi = centerMs + newSpan * (1 - fraction);
      if (newLo < dataRange[0]) {
        newHi += dataRange[0] - newLo;
        newLo = dataRange[0];
      }
      if (newHi > dataRange[1]) {
        newLo -= newHi - dataRange[1];
        newHi = dataRange[1];
      }
      if (newLo <= dataRange[0] && newHi >= dataRange[1]) {
        setZoomDomain(null);
      } else {
        setZoomDomain([Math.max(dataRange[0], newLo), Math.min(dataRange[1], newHi)]);
      }
    },
    [dataRange, minSpanMs],
  );

  const onTouchEnd = useCallback(() => {
    pinchStateRef.current = null;
  }, []);

  return {
    containerRef,
    isZoomed: zoomDomain !== null,
    visibleRows,
    dragRange,
    resetZoom,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave: onMouseUp,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onDoubleClick: resetZoom,
    },
  };
}
