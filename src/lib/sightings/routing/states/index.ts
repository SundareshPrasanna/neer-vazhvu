import type { StateRouting } from "../types";
import { AP } from "./ap";
import { DL } from "./dl";
import { GJ } from "./gj";
import { HR } from "./hr";
import { KA } from "./ka";
import { KL } from "./kl";
import { MH } from "./mh";
import { TG } from "./tg";
import { TN } from "./tn";
import { WB } from "./wb";

/** Keyed by ISO 3166-2 subdivision code, matching PlaceConfig.stateCode. */
export const STATE_ROUTING: Record<string, StateRouting> = { AP, DL, GJ, HR, KA, KL, MH, TG, TN, WB };
