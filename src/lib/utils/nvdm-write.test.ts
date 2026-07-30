/**
 * Preservation regression for the TS envelope-preserving writer (round-5
 * review of #215: two producers wrote bare payloads over governed artifacts,
 * so the writer's guarantee needs a pinned test, not just call sites).
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeArtifact } from "../../../scripts/lib/nvdm-write";

test("writeArtifact preserves an existing envelope and advances produced_at", () => {
  const dir = mkdtempSync(join(tmpdir(), "nvdm-write-"));
  const p = join(dir, "artifact.json");
  writeFileSync(
    p,
    JSON.stringify({
      nvdm: "1.0",
      dataset: "data-root/ward-risk",
      scope: { kind: "city", id: "madurai" },
      provenance: {
        sources: [],
        method: "derived",
        produced_at: "2026-01-01",
        internal_inputs: ["fixtures/internal-input.geojson"],
        note: "x",
      },
      wards: [1],
    }),
  );
  writeArtifact(p, { wards: [1, 2], algorithm_version: "v2" });
  const out = JSON.parse(readFileSync(p, "utf-8"));
  assert.equal(out.nvdm, "1.0");
  assert.equal(out.dataset, "data-root/ward-risk");
  assert.deepEqual(out.provenance.internal_inputs, [
    "fixtures/internal-input.geojson",
  ]);
  assert.notEqual(out.provenance.produced_at, "2026-01-01");
  assert.deepEqual(out.wards, [1, 2]);
  assert.equal(out.algorithm_version, "v2");
});

test("writeArtifact writes bare payload when no envelope exists (unmigrated)", () => {
  const dir = mkdtempSync(join(tmpdir(), "nvdm-write-"));
  const p = join(dir, "fresh.json");
  writeArtifact(p, { a: 1 });
  const out = JSON.parse(readFileSync(p, "utf-8"));
  assert.deepEqual(out, { a: 1 });
});
