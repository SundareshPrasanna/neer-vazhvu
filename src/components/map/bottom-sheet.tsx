"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface BottomSheetProps {
  children: React.ReactNode;
  onClose: () => void;
}

const PEEK_PX = 140;   // collapsed: just header + first line visible
const SNAP_HALF = 0.5;  // 50vh
const SNAP_FULL = 0.85; // 85vh

/**
 * Mobile bottom sheet with drag-to-resize.
 * Renders as a normal scrollable panel on md+ screens.
 */
export function BottomSheet({ children, onClose }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(PEEK_PX);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startH = useRef(0);
  // Track whether the drag originated from the content area (pull-to-collapse)
  const isDragFromContent = useRef(false);

  const getMaxHeight = useCallback(() => {
    return typeof window !== "undefined" ? window.innerHeight * SNAP_FULL : 600;
  }, []);

  const snapTo = useCallback((h: number): number => {
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const halfPx = vh * SNAP_HALF;
    const fullPx = vh * SNAP_FULL;

    // If dragged below peek threshold, close
    if (h < PEEK_PX * 0.5) {
      onClose();
      return PEEK_PX;
    }

    // Snap to nearest: peek, half, full
    const dPeek = Math.abs(h - PEEK_PX);
    const dHalf = Math.abs(h - halfPx);
    const dFull = Math.abs(h - fullPx);
    const min = Math.min(dPeek, dHalf, dFull);
    if (min === dFull) return fullPx;
    if (min === dHalf) return halfPx;
    return PEEK_PX;
  }, [onClose]);

  // --- Handle drag (from the grab bar) ---
  const onHandleTouchStart = useCallback((e: React.TouchEvent) => {
    setDragging(true);
    isDragFromContent.current = false;
    startY.current = e.touches[0].clientY;
    startH.current = height;
  }, [height]);

  const onHandleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    const dy = startY.current - e.touches[0].clientY;
    const newH = Math.max(60, Math.min(startH.current + dy, getMaxHeight()));
    setHeight(newH);
  }, [dragging, getMaxHeight]);

  const onHandleTouchEnd = useCallback(() => {
    setDragging(false);
    setHeight(snapTo(height));
  }, [height, snapTo]);

  // --- Content area: pull-to-collapse when scrolled to top ---
  const onContentTouchStart = useCallback((e: React.TouchEvent) => {
    const el = contentRef.current;
    // Only hijack if content is scrolled to the very top
    if (el && el.scrollTop <= 0) {
      isDragFromContent.current = true;
      startY.current = e.touches[0].clientY;
      startH.current = height;
    } else {
      isDragFromContent.current = false;
    }
  }, [height]);

  const onContentTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragFromContent.current) return;

    const dy = startY.current - e.touches[0].clientY;

    // User is swiping down (dy < 0) while at scroll top - start sheet drag
    if (dy < -5) {
      if (!dragging) setDragging(true);
      const newH = Math.max(60, Math.min(startH.current + dy, getMaxHeight()));
      setHeight(newH);
      // Prevent the content from scrolling while we're dragging the sheet
      e.preventDefault();
    }
    // User is swiping up - let normal scroll happen, cancel content drag
    if (dy > 5 && !dragging) {
      isDragFromContent.current = false;
    }
  }, [dragging, getMaxHeight]);

  const onContentTouchEnd = useCallback(() => {
    if (isDragFromContent.current && dragging) {
      setDragging(false);
      setHeight(snapTo(height));
    }
    isDragFromContent.current = false;
  }, [dragging, height, snapTo]);

  // Tap the handle to toggle between peek and half
  const onHandleTap = useCallback(() => {
    if (dragging) return;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const halfPx = vh * SNAP_HALF;
    setHeight((h) => (h <= PEEK_PX ? halfPx : PEEK_PX));
  }, [dragging]);

  // Reset height on window resize
  useEffect(() => {
    const handler = () => setHeight((h) => Math.min(h, getMaxHeight()));
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [getMaxHeight]);

  return (
    <>
      {/* Mobile: bottom sheet */}
      <div
        ref={sheetRef}
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 rounded-t-xl shadow-2xl z-[1001] flex flex-col"
        style={{
          height: `${height}px`,
          transition: dragging ? "none" : "height 0.3s ease-out",
        }}
      >
        {/* Drag handle - larger touch target */}
        <div
          className="flex-shrink-0 flex items-center justify-center py-3 cursor-grab active:cursor-grabbing"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          onClick={onHandleTap}
        >
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        {/* Content - supports pull-to-collapse when scrolled to top */}
        <div
          ref={contentRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
          onTouchStart={onContentTouchStart}
          onTouchMove={onContentTouchMove}
          onTouchEnd={onContentTouchEnd}
        >
          {children}
        </div>
      </div>

      {/* Desktop: normal sidebar panel */}
      <div className="hidden md:flex h-full md:w-80 lg:w-96 border-l border-slate-200 dark:border-slate-700 flex-col">
        {children}
      </div>
    </>
  );
}
