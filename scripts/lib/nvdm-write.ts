/**
 * Envelope-preserving artifact writer for TypeScript producers - the twin of
 * scripts/nvdm_write.py (see its header for the decay bug this closes).
 * Every TS producer writing under public/data or public/geojson MUST write
 * through this helper unless it emits its own complete envelope (the
 * ward-profiles pattern).
 */
import { existsSync, readFileSync, writeFileSync } from "fs";

const ENVELOPE_KEYS = ["nvdm", "dataset", "scope", "provenance", "projection", "ext"] as const;

/** Write payload to path, preserving any existing NVDM envelope and advancing
 *  provenance.produced_at to today (the artifact is being produced now).
 *  `compact` keeps minified artifacts minified (the Python twin's flag) -
 *  a single-line geometry layer must not be pretty-printed on regeneration. */
export function writeArtifact(
  path: string,
  payload: Record<string, unknown>,
  opts: { compact?: boolean } = {},
): void {
  let envelope: Record<string, unknown> = {};
  if (existsSync(path)) {
    try {
      const existing = JSON.parse(readFileSync(path, "utf-8"));
      if (existing && typeof existing === "object" && "nvdm" in existing) {
        for (const k of ENVELOPE_KEYS) {
          if (k in existing) envelope[k] = existing[k];
        }
        const prov = envelope["provenance"] as Record<string, unknown> | undefined;
        if (prov && typeof prov === "object") {
          prov["produced_at"] = new Date().toISOString().slice(0, 10);
        }
      }
    } catch {
      envelope = {};
    }
  }
  const out: Record<string, unknown> = { ...envelope };
  for (const [k, v] of Object.entries(payload)) {
    if (!(k in envelope)) out[k] = v;
  }
  writeFileSync(path, opts.compact ? JSON.stringify(out) : JSON.stringify(out, null, 2));
}
