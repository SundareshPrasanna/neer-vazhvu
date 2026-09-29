import type { WaterwayStory } from "./types";
import { BUCKINGHAM_CANAL_STORY } from "./buckingham-canal.story";
import { COOUM_STORY } from "./cooum.story";

/** Story copy by waterway id; imported by the server page only. */
export const WATERWAY_STORIES: Record<string, WaterwayStory> = {
  "buckingham-canal": BUCKINGHAM_CANAL_STORY,
  cooum: COOUM_STORY,
};
