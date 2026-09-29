// Entry point kept because hyderabad-rivers.geojson names it in produced_by; the fetch is fetch-osm-layers.ts.
import { main } from "./fetch-osm-layers";

main(["--city", "hyderabad", "--layer", "rivers"]);
