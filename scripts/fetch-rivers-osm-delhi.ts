// Entry point kept because delhi-rivers.geojson names it in produced_by; the fetch is fetch-osm-layers.ts.
import { main } from "./fetch-osm-layers";

main(["--city", "delhi", "--layer", "rivers"]);
