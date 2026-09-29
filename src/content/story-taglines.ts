import type { CityId } from "@/lib/cities/ids";

/** English Origins tagline per city: the page title and the story's hero line
 *  read this one entry, so the two cannot drift apart. */
export const STORY_TAGLINES: Record<CityId, string> = {
  chennai:
    "City of estuaries - what is left of the sponge",
  madurai:
    "City of Tanks - what is left of the cascade",
  bangalore:
    "City of stolen kere - what Kempegowda built and what Bengaluru built over it",
  mumbai:
    "City of seven islands - a place with no river, and the forty-five litres that divide it",
  delhi:
    "The city that stored water for a thousand years - and the twenty-two kilometres where its river dies",
  hyderabad:
    "City of tanks - how Hyderabad engineered its way out of a flood, and what it still owes that system",
  kolkata:
    "The city that built itself around a pond - and the wetland that takes what it throws away",
  gurugram:
    "The city that outgrew its water in twelve years",
  pune:
    "The city that dammed one river four times and still counts four hours",
  surat:
    "The city the river made, unmade, and made again",
};
