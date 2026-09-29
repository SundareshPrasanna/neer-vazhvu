// Entry point kept because bangalore-water-bodies-current.geojson names it in produced_by; the fetch is fetch-osm-layers.ts.
import { main } from "./fetch-osm-layers";

main(["--city", "bangalore", "--layer", "water-bodies"]);
