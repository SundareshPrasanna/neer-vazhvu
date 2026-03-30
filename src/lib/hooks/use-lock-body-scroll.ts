import { useEffect } from "react";

/** Prevents body scrolling while the component is mounted. Used by full-viewport map pages. */
export function useLockBodyScroll() {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
}
