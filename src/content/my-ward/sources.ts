import type { CityId } from "@/lib/cities/ids";
import { MY_WARD_CONTENT } from "@/cities/generated/my-ward";
import type { WardSourceCopy } from "./types";

export type { WardSourceCopy } from "./types";

/** A city's My Ward source lines, from src/cities/<id>/my-ward.ts. A city
 *  renders only the lines it records; none recorded -> empty, never another
 *  city's source. */
export const wardSources = (cityId: string): WardSourceCopy =>
  MY_WARD_CONTENT[cityId as CityId]?.sources ?? {};
