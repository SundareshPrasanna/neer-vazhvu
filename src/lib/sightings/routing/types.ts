import type { AuthorityRole } from "../taxonomy";

export interface Channel {
  kind: "app" | "portal" | "helpline" | "whatsapp" | "email";
  label: string;
  url?: string;
  phone?: string;
  /** The channel issues a reference number the citizen can track. */
  tracked?: boolean;
}

/** One public body for one role, with the official page that says so. */
export interface Authority {
  body: string;
  acronym?: string;
  channels: Channel[];
  source: string;
}

export type RoleTable = Partial<Record<AuthorityRole, Authority>>;

export interface PlaceRouting {
  roles: RoleTable;
  /** Region places: per-corporation overrides, keyed as locate-server resolves them. */
  corporations?: Record<string, RoleTable>;
}

/** One state's file: its statewide bodies and its places (cityId or district scope id). */
export interface StateRouting {
  /** ISO 3166-2 subdivision code, e.g. "TN". */
  stateCode: string;
  checked: string;
  roles: RoleTable;
  places: Record<string, PlaceRouting>;
}

export interface NationalChannel extends Channel {
  roles: AuthorityRole[];
  /** Swachhata covers urban local bodies only. */
  urbanOnly?: boolean;
}
