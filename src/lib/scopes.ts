/**
 * The one TypeScript reader of the NVDM scope registry (schemas/nvdm/scopes.json).
 * Scope ids are opaque names and are never parsed: hierarchy lives in each
 * entry's typed relations, external identities in its refs. Python twin:
 * scripts/nvdm_scopes.py; the graph rules are enforced by scripts/validate_nvdm.py.
 */
import registry from "../../schemas/nvdm/scopes.json";

export interface ScopeRef { system: string; level: string; code: string; as_of?: string }
export interface ScopeEntry {
  kind: string;
  name: string;
  refs?: ScopeRef[];
  relations?: { type: string; target: string; method?: string; evidence?: string }[];
}

const SCOPES: Record<string, ScopeEntry> = registry.scopes;
const WATER_KINDS = new Set(["basin", "waterway", "body"]);
const PARENT = "administrative-parent";

/** Registered ids in registry order, optionally of the given kinds. */
export function scopeIds(...kinds: string[]): string[] {
  return Object.keys(SCOPES).filter((id) => !kinds.length || kinds.includes(SCOPES[id].kind));
}

export const scopeKind = (id: string): string | undefined => SCOPES[id]?.kind;
export const scopeName = (id: string): string | undefined => SCOPES[id]?.name;

export function scopeRefs(id: string, system?: string): ScopeRef[] {
  return (SCOPES[id]?.refs ?? []).filter((r) => !system || r.system === system);
}

export function scopeRelated(id: string, type: string): string[] {
  return (SCOPES[id]?.relations ?? []).filter((r) => r.type === type).map((r) => r.target);
}

/** Every scope reachable over `type`, nearest first. */
export function scopeAncestors(id: string, type = PARENT): string[] {
  const out: string[] = [];
  const todo = scopeRelated(id, type);
  while (todo.length) {
    const t = todo.shift()!;
    if (out.includes(t)) continue;
    out.push(t);
    todo.push(...scopeRelated(t, type));
  }
  return out;
}

/** The one country a scope sits in; undefined when it has none or crosses a border. */
export function scopeCountry(id: string): string | undefined {
  const via = WATER_KINDS.has(scopeKind(id) ?? "") ? scopeRelated(id, "intersects") : [id];
  const found = new Set(via.flatMap((v) => [v, ...scopeAncestors(v)]).filter((a) => scopeKind(a) === "country"));
  return found.size === 1 ? [...found][0] : undefined;
}
