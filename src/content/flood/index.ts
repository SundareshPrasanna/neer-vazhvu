import type { CityId } from "@/lib/cities/ids";
import type { CityFloodContent } from "./types";
import { FLOOD as CHENNAI } from "./chennai";
import { FLOOD as MADURAI } from "./madurai";
import { FLOOD as BANGALORE } from "./bangalore";
import { FLOOD as MUMBAI } from "./mumbai";
import { FLOOD as DELHI } from "./delhi";
import { FLOOD as HYDERABAD } from "./hyderabad";
import { FLOOD as KOLKATA } from "./kolkata";
import { FLOOD as PUNE } from "./pune";
import { FLOOD as SURAT } from "./surat";

/** Per-city content for /[cityId]/flood-risk. */
export const FLOOD_CONTENT: Partial<Record<CityId, CityFloodContent>> = {
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
