// Entry point kept because madurai-rivers.geojson names it in produced_by; the fetch is fetch-osm-layers.ts.
import { main } from "./fetch-osm-layers";

main(["--city", "madurai", "--layer", "rivers"]);
