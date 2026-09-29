import type { CityId } from "@/lib/cities/ids";
import type { CityRiversContent } from "./types";
import { RIVERS as CHENNAI } from "./chennai";
import { RIVERS as MADURAI } from "./madurai";
import { RIVERS as BANGALORE } from "./bangalore";
import { RIVERS as MUMBAI } from "./mumbai";
import { RIVERS as DELHI } from "./delhi";
import { RIVERS as HYDERABAD } from "./hyderabad";
import { RIVERS as KOLKATA } from "./kolkata";
import { RIVERS as PUNE } from "./pune";
import { RIVERS as SURAT } from "./surat";

/** Per-city content for /[cityId]/rivers. A city with "rivers" in its routes
 *  and no entry here renders the not-yet-available state. */
export const RIVERS_CONTENT: Partial<Record<CityId, CityRiversContent>> = {
  chennai: CHENNAI,
  madurai: MADURAI,
  bangalore: BANGALORE,
  mumbai: MUMBAI,
  delhi: DELHI,
  hyderabad: HYDERABAD,
  kolkata: KOLKATA,
  pune: PUNE,
  surat: SURAT,
};
