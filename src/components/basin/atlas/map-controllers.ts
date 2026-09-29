import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/** Keep the map framed: the whole basin by default, the selected river's
 *  sub-catchments when one is chosen. */
export function MapController({
  fitBounds,
  defaultFocus,
  hasSelection,
}: {
  fitBounds: L.LatLngBounds | null;
  defaultFocus?: { center: [number, number]; zoom: number };
  hasSelection: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (fitBounds && fitBounds.isValid()) {
      // A river is selected: fit its full extent (zooming out if the river spans
      // more than the default view, e.g. the basin-long Arkavathi).
      map.fitBounds(fitBounds, { padding: [8, 8], maxZoom: 14 });
    } else if (defaultFocus && !hasSelection) {
      // Nothing selected and the manifest pins a focus view - honour it instead
      // of the (too-wide) whole-basin boundary fit. Suppressed while a river is
      // selected so the focus view never pre-empts that river's fit (e.g. before
      // its sub-catchments finish loading).
      map.setView(defaultFocus.center, defaultFocus.zoom);
    }
  }, [fitBounds, defaultFocus, hasSelection, map]);
  return null;
}

/** Fly to a freshly highlighted region ("Show X on the map"). Keyed on the
 *  bbox so other layers streaming in (which recompute the bounds object but
 *  not its extent) don't re-trigger the flight. */
export function HighlightFlyer({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  const lastRef = useRef<string>("");
  useEffect(() => {
    // Highlight cleared (Reset): forget the last flight so re-highlighting
    // the same region flies again.
    if (!bounds) { lastRef.current = ""; return; }
    const key = bounds.toBBoxString();
    if (key === lastRef.current) return;
    lastRef.current = key;
    map.flyToBounds(bounds, { padding: [30, 30], maxZoom: 13, duration: 0.8 });
  }, [bounds, map]);
  return null;
}

/** Fly to the visitor's location when it is (re)acquired. If they're inside the
 *  mapped basin we zoom in close so nearby stretches / industrial areas read;
 *  if they're outside it we frame both their pin and the basin so the distance
 *  is honest rather than dropping them into empty tiles. */
export function LocateFlyer({
  location,
  basinBounds,
}: {
  location: { lat: number; lng: number } | null;
  basinBounds: L.LatLngBounds | null;
}) {
  const map = useMap();
  const lastRef = useRef<string>("");
  useEffect(() => {
    if (!location) return;
    const key = `${location.lat.toFixed(5)},${location.lng.toFixed(5)}`;
    if (key === lastRef.current) return;
    lastRef.current = key;
    const here = L.latLng(location.lat, location.lng);
    const inside = basinBounds?.contains(here) ?? true;
    if (inside) {
      map.flyTo(here, Math.max(map.getZoom(), 14), { duration: 0.8 });
    } else if (basinBounds) {
      map.flyToBounds(L.latLngBounds([here]).extend(basinBounds), {
        padding: [40, 40],
        duration: 0.8,
      });
    } else {
      map.flyTo(here, 13, { duration: 0.8 });
    }
  }, [location, basinBounds, map]);
  return null;
}
