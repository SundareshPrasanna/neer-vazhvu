// Entry point kept because chennai-industrial-zones.geojson names it in produced_by; the fetch is fetch-osm-layers.ts.
import { main } from "./fetch-osm-layers";

main(["--city", "chennai", "--layer", "industrial-zones"]);
