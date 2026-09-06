#!/usr/bin/env python3
"""Stop envelope metadata drifting back in the next time a producer runs.

THE DEFECT THIS EXISTS FOR. PR #227 corrected 209 source licences across 154
envelopes and added rights determinations to five artefacts. The artefacts were
right; the PRODUCERS were not. `build_delhi_ward_profiles.py` still held the old
OpenCity and WRIS literals and emitted no determination, so running it restored
three stale licences, deleted the determination, and dropped the artefact a
conformance level. Nothing detected that, because only three of ~85 producers
have a regeneration diff in CI.

Running all 85 in CI is not possible: most fetch from a network, an authenticated
portal, or Earth Engine. So this checks the thing that actually drifts, and
checks it for every producer at once, offline and deterministically:

  1. NO GENERATOR MAY HARDCODE A REGISTERED SOURCE'S LICENCE. A dict literal
     carrying both an `id` that is in the Headwaters registry and a `license`
     string literal is a second copy of a fact the registry owns, and second
     copies drift. Use registry_license() / registryLicense().

  2. A PRODUCER MUST EMIT THE RIGHTS DETERMINATION ITS ARTEFACT CARRIES. If an
     artefact has provenance.rights_determination and its produced_by script
     never mentions one, the next run deletes an audited legal judgement
     silently. That is worse than never having recorded it.

  3. NO ARTEFACT MAY STATE A LICENCE ITS OWN ENVELOPE CONTRADICTS. Rules 1-2
     look at generators, and rule 1 only ever looked for `id` and `license` in
     the SAME dict - so it saw nothing at all of the 153 licence strings living
     in `data_source.license`, `features[].properties.license`, `_meta.licence`,
     `_source.license` and friends. Twenty-one JRC artefacts carried the
     verified Copernicus terms in the envelope AND "EC Open / public domain" in
     a nested legacy field, which the classifier reads as vague: one file
     asserting two different licence positions. Twenty-one Overture artefacts
     were worse, claiming CDLA-Permissive where the registry says share-alike,
     understating an obligation.

     So this rule checks the OUTPUT rather than the code, which is the only way
     to be shape-independent: every licence-bearing field anywhere in an
     enveloped artefact, outside provenance.sources[], must exactly equal the
     registry licence of a source that artefact declares - or be a declared
     composite that quotes several of them verbatim. A hardcoded licence
     cannot hide in a nested dict, a tuple, a constant defined elsewhere, an
     f-string or a separate config file, because all of them have to come out
     here eventually.

  4. A LICENCE LITERAL ANYWHERE IN A GENERATOR must be a decided one-off, in
     any language. The Python-only version of rule 1 is why a TypeScript
     `license: "ODbL"` survived a full sweep.

  5. NO PRODUCER MAY ERASE THE ENVELOPE IT REFRESHES. A different failure class
     from licence drift and a worse one: fetch-rich-body-polygon.ts wrote a
     bare `{type, features}` over 40 enveloped artifacts, which would have
     deleted provenance, sources, scope and lineage outright. A wrong licence
     argues with itself loudly; an absent envelope is silent.

  6. AN ENVELOPE'S INLINE LICENCE MUST EQUAL THE REGISTRY'S, and where a path
     names a city the scope must be that city. Both come from running the
     coverage experiment below rather than from reasoning.

WHAT THIS DOES NOT CATCH. Measured, not assumed - scripts in the PR history
inject each fault into a real artifact and check whether any gate fails:

  - `provenance.sources` emptied on an artifact that still has internal_inputs.
    Lineage keeps its bucket, and validate_nvdm deliberately accepts an empty
    source array backed by produced_by. Detecting it needs a baseline of what
    the file used to declare, which no gate here has.
  - scope wrong on a path that does not name a city (the Chennai-by-default
    files). Rule 6 covers 142 of 363 artifacts.
  - payload VALUES drifting - a producer computing a different number. Nothing
    here reads values, and only the four regeneration-diffed producers would
    catch it.

Rules 1-2 and 4-5 need no producer run; rules 3 and 6 need no producer at all.
Run with --list to see the producer inventory and which ones have real
regeneration-diff coverage.

Stdlib only.
"""

from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from registry_license import registry_licenses  # noqa: E402

REG = registry_licenses()

GENERATOR_DIRS = ("scripts", "neer-vazhvu-api/scripts", "neer-vazhvu-api/app")

# These read or enforce licences rather than emitting envelopes; a literal in
# them is the subject matter, not a copy that can drift.
EXEMPT = {
    "nvdm-encumbrance-report.py",
    "validate_nvdm.py",
    "build_dataset_catalogue.py",
    "check-mirrored-documents.py",
    "check-sample-corpus.py",
    "check-generator-drift.py",
    "registry_license.py",
}

# Producers CI actually re-runs and diffs. Keep in step with .github/workflows/ci.yml.
REGEN_COVERED = {
    "scripts/compute-ward-profiles.ts",
    "scripts/compute-madurai-ward-profiles.ts",
    "scripts/compute-bangalore-ward-profiles.ts",
    "neer-vazhvu-api/scripts/build_delhi_ward_profiles.py",
}


# Licence literals a generator is ALLOWED to hold, because the source they
# describe has no registry id: closed one-offs, academic papers, single scraped
# documents. Each is here because somebody decided it, and a new literal fails
# the gate until somebody decides that one too.
#
# The alternative - "flag a literal only when an `id` sits in the same dict" -
# is what let scripts/verify_rich_body_water_trend.py keep hardcoding
# "EC Open / public domain" into a nested data_source block through an entire
# licence sweep. A licence literal is suspect wherever it appears.
INLINE_LICENCE_ALLOWLIST = {
    # Closed one-time report, deliberately NOT registered: TGRAC published the
    # ORR encroachment figures but not the layer, and its site states all rights
    # reserved. Only the report's numbers are used, on the Hyderabad facts page.
    # A closed source's inline licence IS the record - there is no registry entry
    # for registry_license() to read. See docs/cities/hyderabad/data-sources.md.
    "Telangana government report, figures cited with attribution; "
    "underlying spatial layer is not published",
    "ADB public project document, cited with attribution",
    "GoI journal publication, cited with attribution",
    "GoI public document, cited with attribution",
    "GoI publication, cited with attribution",
    "GoTN correspondence, cited from ADB IEE Appendix 14 (public project document)",
    "GoTN delimitation record, cited with attribution",
    "JICA public survey report, cited with attribution",
    "Maharashtra government publication, cited with attribution",
    "OECD working paper, cited with attribution",
    "UNPROVEN - no licence was recorded for this layer when it entered "
    "the repo; not assertable as government-clean",
    "academic publication, cited with attribution",
    "academic publication, cited with attribution (qualitative use only)",
    "academic working paper, cited with attribution",
    "government handbook, cited with attribution",
    "government plan document, cited with attribution",
    # KSPCB's published F-register of consented industries: a government
    # document with no registry id of its own (the board publishes it as a
    # standalone per-office PDF, not through a feed we track).
    "government register, cited with attribution",
    "portal label only (OpenCity dataset page); no upstream grant established",
    "public policy document, cited with attribution",
    # Closed partner deliveries (Paani Earth GeoPackages, Kabini build): the
    # delivery itself has no registry id; each layer's underlying government
    # origin is attributed in the source title.
    "partner-supplied compilation, cited with attribution; underlying government layers as attributed per layer",
    "published civil-society report, cited with attribution",
    # Tribunal proceedings that reach the public only through the press (NGT
    # OA 150/2025, Powai Lake): the order itself is not published online, so the
    # press report is the record and has no registry id to read from.
    "press report of tribunal proceedings, cited with attribution",
    "published report, registration-gated download, cited with attribution",
    # TypeScript one-offs, same rule.
    "GoTN delimitation record, cited with attribution ",
    # REMOVED 2026-08-01: "ODbL" and "Public data from Tamil Nadu State Wetland
    # Authority portal" sat here and should never have. Their artifacts DECLARE
    # osm-overpass and tnswa-ramsar-boundary, so the allowlist was excusing
    # exactly the case it exists to catch. Both producers now call
    # registryLicense(). An entry belongs here only when the source it describes
    # has no registry id at all.
}


# `license: "..."` / `"license": "..."` / `'licence': '...'` in ANY language.
# The Python-only version of this rule is why the TypeScript "ODbL" literal in
# fetch-rich-body-polygon.ts survived: the scan simply never opened a .ts file.
TEXT_LICENCE_LITERAL = re.compile(
    r"""["']?(?:license|licence)["']?\s*:\s*(?P<q>["'])(?P<val>(?:(?!(?P=q)).)*)(?P=q)""",
    re.S,
)


def literal_allowlist_errors() -> list[str]:
    """Any licence STRING LITERAL in a generator must be a decided one-off.

    Language-agnostic on purpose. A licence literal is the same mistake in
    Python, TypeScript, JSON-in-a-heredoc or anything else a producer is
    written in, and a rule that only reads one language is a rule that fails
    the moment somebody writes the next producer in the other one.
    """
    errs: list[str] = []
    for d in GENERATOR_DIRS:
        for p in sorted(ROOT.joinpath(d).rglob("*")):
            if p.suffix not in (".py", ".ts", ".tsx", ".js", ".mjs") or not p.is_file():
                continue
            if p.name in EXEMPT:
                continue
            src = p.read_text()
            for m in TEXT_LICENCE_LITERAL.finditer(src):
                val = m.group("val")
                if not val or val in INLINE_LICENCE_ALLOWLIST:
                    continue
                line = src[: m.start()].count("\n") + 1
                helper = (
                    "registryLicense()" if p.suffix != ".py" else "registry_license()"
                )
                errs.append(
                    f"{p.relative_to(ROOT)}:{line}: licence string literal "
                    f"{val[:60]!r} - if it describes a REGISTERED source use "
                    f"{helper}; if the source has no registry id, add it to "
                    f"INLINE_LICENCE_ALLOWLIST with a reason"
                )
    return errs


def python_literal_errors() -> list[str]:
    errs: list[str] = []
    for d in GENERATOR_DIRS:
        for p in sorted((ROOT / d).rglob("*.py")):
            if p.name in EXEMPT:
                continue
            src = p.read_text()
            if '"license"' not in src and "'license'" not in src:
                continue
            try:
                tree = ast.parse(src)
            except SyntaxError:
                continue
            for node in ast.walk(tree):
                if not isinstance(node, ast.Dict):
                    continue
                pairs = {
                    k.value: v
                    for k, v in zip(node.keys, node.values)
                    if isinstance(k, ast.Constant) and isinstance(k.value, str)
                }
                sid, lic = pairs.get("id"), pairs.get("license")
                if sid is None or lic is None:
                    continue
                if not (isinstance(sid, ast.Constant) and isinstance(sid.value, str)):
                    continue
                if sid.value not in REG:
                    continue
                if isinstance(lic, ast.Constant) and isinstance(lic.value, str):
                    errs.append(
                        f"{p.relative_to(ROOT)}:{lic.lineno}: hardcoded licence for "
                        f"registered source '{sid.value}' - use "
                        f"registry_license(\"{sid.value}\")"
                    )
    return errs


# id: "x", ... license: "literal"  - the TypeScript shape.
TS_PAIR = re.compile(
    r'id:\s*"(?P<sid>[a-z0-9\-]+)",(?:[^{}]|\{[^{}]*\})*?license:\s*"', re.S
)


def ts_literal_errors() -> list[str]:
    errs: list[str] = []
    for d in GENERATOR_DIRS:
        for p in sorted((ROOT / d).rglob("*.ts")):
            src = p.read_text()
            if "license:" not in src:
                continue
            for m in TS_PAIR.finditer(src):
                sid = m.group("sid")
                if sid not in REG:
                    continue
                line = src[: m.start()].count("\n") + 1
                errs.append(
                    f"{p.relative_to(ROOT)}:{line}: hardcoded licence for registered "
                    f'source \'{sid}\' - use registryLicense("{sid}")'
                )
    return errs


def determination_errors() -> tuple[list[str], list[str]]:
    """Artefacts whose producer would silently drop their determination."""
    errs: list[str] = []
    ok: list[str] = []
    for top in ("public/data", "public/geojson"):
        for p in sorted((ROOT / top).rglob("*")):
            if p.suffix not in (".json", ".geojson") or not p.is_file():
                continue
            try:
                doc = json.loads(p.read_text())
            except Exception:
                continue
            if not isinstance(doc, dict) or "nvdm" not in doc:
                continue
            prov = doc.get("provenance") or {}
            if "rights_determination" not in prov:
                continue
            rel = str(p.relative_to(ROOT))
            producer = (prov.get("produced_by") or "").strip()
            script = producer.split()[0] if producer else ""
            sp = ROOT / script
            if not script or not sp.exists():
                errs.append(
                    f"{rel}: carries a rights_determination but produced_by "
                    f"'{producer or '(none)'}' is not a file in this repo - nothing "
                    f"guarantees a rerun preserves it"
                )
                continue
            if "rights_determination" not in sp.read_text():
                errs.append(
                    f"{rel}: carries a rights_determination but its producer "
                    f"{script} never emits one - rerunning it deletes an audited "
                    f"legal judgement silently"
                )
            else:
                ok.append(f"{rel} <- {script}")
    return errs, ok


# Keys anywhere in an artifact that assert a licence position.
LICENCE_KEYS = ("license", "licence")


def _legacy_licence_fields(doc: dict) -> list[tuple[str, str]]:
    """Every licence-bearing field OUTSIDE provenance. (path, value)."""
    out: list[tuple[str, str]] = []

    def walk(node, path: str) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                p = f"{path}.{k}"
                if k in LICENCE_KEYS and isinstance(v, str):
                    out.append((p, v))
                walk(v, p)
        elif isinstance(node, list):
            for v in node:
                walk(v, path)

    walk({k: v for k, v in doc.items() if k != "provenance"}, "$")
    return out


def legacy_licence_errors() -> tuple[list[str], int]:
    """A legacy field must not contradict the envelope that governs the file."""
    errs: list[str] = []
    checked = 0
    for top in ("public/data", "public/geojson"):
        for p in sorted((ROOT / top).rglob("*")):
            if p.suffix not in (".json", ".geojson") or not p.is_file():
                continue
            try:
                doc = json.loads(p.read_text())
            except Exception:
                continue
            if not isinstance(doc, dict) or "nvdm" not in doc:
                continue
            fields = _legacy_licence_fields(doc)
            if not fields:
                continue
            rel = str(p.relative_to(ROOT))
            declared = [
                s["id"]
                for s in ((doc.get("provenance") or {}).get("sources") or [])
                if isinstance(s, dict) and s.get("id") and s["id"] in REG
            ]
            allowed = {REG[s] for s in declared}
            for path, value in fields:
                checked += 1
                if value in allowed:
                    continue
                # A composite is fine only if it quotes registry strings verbatim
                # AND every source it leans on is declared by this artifact.
                quoted = [lic for lic in allowed if lic and lic in value]
                if len(quoted) >= 2:
                    continue
                errs.append(
                    f"{rel}: {path} = {value[:60]!r} does not match any declared "
                    f"source's registry licence ({', '.join(declared) or 'none declared'})"
                    " - a second, unmaintained copy of a licence is how the JRC and"
                    " Overture artifacts came to assert two positions at once"
                )
    return errs, checked


# Writers that preserve an existing envelope, or emit a complete one.
ENVELOPE_SAFE_TOKENS = ("writeArtifact", "write_artifact", "merge_envelope")
# A write that replaces a file wholesale.
BARE_WRITE = re.compile(
    r"(writeFileSync\s*\(|\.write_text\s*\(|json\.dump\s*\(|\.writeFile\s*\()"
)

# Producers allowed to write bare, with the reason. Empty today: every producer
# of an enveloped artifact either preserves the envelope or emits its own.
ENVELOPE_WRITE_ALLOWLIST: dict[str, str] = {
    "scripts/build_kabini_sources.py": (
        "the bare _write() targets STAGING files under .cache/kabini-sources/ "
        "(inputs to ingest_basin.py), never serving artifacts; its one serving "
        "write (kabini/accountability.json) goes through merge_envelope"
    ),
}


def _write_target(src: str, match: "re.Match[str]") -> str:
    """The expression a wholesale write is aimed at, as written in the source."""
    call = match.group(1)
    if call.startswith("."):  # path.write_text(...)
        before = src[: match.start()]
        m = re.search(r"([A-Za-z_][\w\.]*)\s*$", before)
        return m.group(1) if m else ""
    # writeFileSync(target, ...) / writeFile(target, ...) / json.dump(obj, target)
    args = src[match.end() :]
    parts = args.split(",", 2)
    idx = 1 if call.startswith("json.dump") else 0
    return parts[idx].strip() if len(parts) > idx else ""


def _targets_an_artifact(src: str, target: str, arts: list[str]) -> bool:
    """Does `target` resolve to one of this producer's enveloped artifacts?

    Follows assignments a few hops, so `text_cache = OCR_CACHE / ...` is seen to
    be a cache path rather than an artifact. Unresolvable targets are treated as
    artifacts: a gate that cannot tell must not wave the write through.
    """
    names = {Path(a).name for a in arts}
    # Paths that are demonstrably not published artifacts.
    SIDE = (".cache", "/tmp", "tmpdir", "scratch", "node_modules")
    seen: set[str] = set()
    frontier = [target]
    for _ in range(5):
        nxt: list[str] = []
        for expr in frontier:
            if not expr or expr in seen:
                continue
            seen.add(expr)
            if any(n in expr for n in names) or "public/" in expr:
                return True
            if any(s in expr for s in SIDE):
                return False  # resolved to a cache or scratch path
            root = re.match(r"([A-Za-z_]\w*)", expr)
            if not root:
                continue
            # Match plain, const/let/var and typed declarations in either language.
            nxt.extend(_assignment_values(src, root.group(1)))
        if not nxt:
            break
        frontier = nxt
    # Unresolved. Fail CLOSED: a gate that cannot tell what a write targets must
    # not wave it through, and must not be swayed by a safe writer elsewhere in
    # the file - that inference is the very fail-open this check exists to stop.
    return True


# schemas/nvdm/envelope.schema.json $defs.envelope.required. An `nvdm` token
# nested somewhere in a payload is not an envelope: a FeatureCollection with
# metadata.nvdm still loses provenance, scope and lineage on write.
ENVELOPE_REQUIRED = {"nvdm", "dataset", "scope", "provenance"}


def _toplevel_keys(literal: str) -> set[str]:
    """Keys at depth 1 of an object literal, quoted or bare (JS and Python)."""
    text = literal.strip()
    if not text.startswith("{"):
        return set()
    keys: set[str] = set()
    depth = 0
    i = 0
    while i < len(text):
        c = text[i]
        if c in "{[(":
            depth += 1
        elif c in "}])":
            depth -= 1
            if depth == 0:
                break
        elif c in "\"'" and depth == 1:
            q = c
            j = text.find(q, i + 1)
            if j == -1:
                break
            k = j + 1
            while k < len(text) and text[k] in " \t\n":
                k += 1
            if k < len(text) and text[k] == ":":
                keys.add(text[i + 1 : j])
            i = j
        elif depth == 1 and (c.isalpha() or c == "_"):
            m = re.match(r"[A-Za-z_]\w*", text[i:])
            if m:
                k = i + m.end()
                while k < len(text) and text[k] in " \t\n":
                    k += 1
                if k < len(text) and text[k] == ":":
                    keys.add(m.group(0))
                i = k - 1
        i += 1
    return keys


def _assignment_values(src: str, name: str) -> list[str]:
    """Every right-hand side assigned to `name`, whole-value not first-line.

    `const wrapped = {\\n  nvdm: "1.0", ...\\n}` spans many lines; capturing only
    to the newline sees `{` and concludes nothing, which is how a producer that
    plainly emits an envelope looked like one that erases it.
    """
    out: list[str] = []
    pat = re.compile(
        rf"(?:^|\b)(?:const|let|var)?\s*{re.escape(name)}"
        rf"(?:\s*:\s*[\w<>\[\]\.]+)?\s*=\s*",
        re.M,
    )
    for m in pat.finditer(src):
        i = m.end()
        while i < len(src) and src[i] in " \t":
            i += 1
        if i < len(src) and src[i] in "{[(":
            pairs = {"{": "}", "[": "]", "(": ")"}
            opener, closer, depth = src[i], pairs[src[i]], 0
            for j in range(i, len(src)):
                if src[j] == opener:
                    depth += 1
                elif src[j] == closer:
                    depth -= 1
                    if depth == 0:
                        out.append(src[i : j + 1])
                        break
        else:
            out.append(src[i : src.find("\n", i) if "\n" in src[i:] else len(src)])
    return out


def _call_args(src: str, open_paren: int) -> str:
    """Text between `open_paren` and its match, or "" if unbalanced."""
    depth = 0
    for i in range(open_paren, len(src)):
        if src[i] == "(":
            depth += 1
        elif src[i] == ")":
            depth -= 1
            if depth == 0:
                return src[open_paren : i + 1]
    return ""


def _safe_within_call(src: str, open_paren: int) -> bool:
    """Does the argument list starting at `open_paren` contain a safe writer?

    Scoped to THIS call, not the file. `path.write_text(json.dumps(
    merge_envelope(path, out)))` is safe; a `writeFileSync` elsewhere in the
    same file is not made safe by it.
    """
    args = _call_args(src, open_paren)
    return bool(args) and any(t in args for t in ENVELOPE_SAFE_TOKENS)


def _emits_envelope(src: str, open_paren: int) -> bool:
    """Does THIS write emit a complete envelope of its own?

    Per write call, never per file. A producer with two outputs - one that
    builds `{"nvdm": "1.0", ...}` and one that writes a bare FeatureCollection -
    used to have both exempted by the first, which is a silent envelope wipe on
    the second. Follows the payload's assignments a few hops, so a `doc` built
    above the write still counts.
    """
    args = _call_args(src, open_paren)
    if not args:
        return False  # unparseable: do not exempt
    seen: set[str] = set()
    frontier = [args]
    for _ in range(4):
        nxt: list[str] = []
        for expr in frontier:
            if not expr or expr in seen:
                continue
            seen.add(expr)
            if ENVELOPE_REQUIRED <= _toplevel_keys(expr):
                return True
            for ident in set(re.findall(r"[A-Za-z_]\w*", expr)):
                nxt.extend(_assignment_values(src, ident))
        if not nxt:
            break
        frontier = nxt
    return False


def envelope_destruction_errors() -> tuple[list[str], int]:
    """A refresh must not replace an enveloped artifact with a bare payload.

    A DIFFERENT failure class from licence drift, and a worse one. A wrong
    licence string is visible and classifies loudly; an absent envelope is
    silent - the file simply stops appearing on the conformance ladder, taking
    provenance, sources, scope and lineage with it.

    scripts/fetch-rich-body-polygon.ts wrote
    `writeFileSync(path, JSON.stringify({type, features}))` over 40 enveloped
    artifacts. Nothing in this repo noticed, because every check so far asked
    what a producer SAYS about licences, never what it does to the wrapper.

    A producer is safe if it writes through an envelope-preserving helper, or
    emits a complete envelope itself (the ward-profiles pattern).
    """
    errs: list[str] = []
    checked = 0
    producers: dict[str, list[str]] = {}
    for top in ("public/data", "public/geojson"):
        for p in sorted((ROOT / top).rglob("*")):
            if p.suffix not in (".json", ".geojson") or not p.is_file():
                continue
            try:
                doc = json.loads(p.read_text())
            except Exception:
                continue
            if not isinstance(doc, dict) or "nvdm" not in doc:
                continue
            pb = ((doc.get("provenance") or {}).get("produced_by") or "").strip()
            if pb:
                producers.setdefault(pb.split()[0], []).append(str(p.relative_to(ROOT)))

    for script, arts in sorted(producers.items()):
        f = ROOT / script
        if not f.exists() or not f.is_file():
            continue
        checked += 1
        src = f.read_text()
        if script in ENVELOPE_WRITE_ALLOWLIST:
            continue  # a recorded human decision, per producer by design

        # Per-write-site, never per-file. A producer that calls a safe writer
        # somewhere is not thereby safe everywhere: one writeArtifact() beside
        # one writeFileSync() used to exempt the whole file, which is exactly
        # how envelope erasure returns. A wholesale write is safe only when
        # THAT call wraps a safe writer, as in
        # path.write_text(json.dumps(merge_envelope(path, payload))).
        sites = []
        for m in BARE_WRITE.finditer(src):
            if _safe_within_call(src, m.end() - 1):
                continue  # this call wraps merge_envelope/write_artifact
            if _emits_envelope(src, m.end() - 1):
                continue  # this call writes a complete envelope of its own
            if not _targets_an_artifact(src, _write_target(src, m), arts):
                continue  # writes a cache or side file, not an enveloped artifact
            sites.append((src.count("\n", 0, m.start()) + 1, m.group(1).rstrip("( ")))
        if not sites:
            continue
        where = ", ".join(f"{call} at line {ln}" for ln, call in sites)
        errs.append(
            f"{script}: writes {len(arts)} enveloped artifact(s) and contains "
            f"{len(sites)} wholesale write(s) ({where}). Each one replaces the "
            f"NVDM wrapper with a bare payload and silently drops the artifact "
            f"off the conformance ladder. Route every write of an enveloped "
            f"artifact through writeArtifact()/write_artifact(), emit a complete "
            f"envelope, or record the producer in ENVELOPE_WRITE_ALLOWLIST with "
            f"the reason each site is safe"
        )
    return errs, checked


def envelope_licence_errors() -> tuple[list[str], int]:
    """An envelope's inline licence must equal the registry's, corpus-wide.

    validate_nvdm.py has enforced this per artifact since the envelopes were
    reconciled, but only as an L2 demotion - and `validate_nvdm.py --check`
    with no target arguments checks nothing at all and exits 0, which is how I
    came to report it as passing verification twice. The rule needs somewhere
    that actually fails the build over the WHOLE corpus, so here it is.
    """
    errs: list[str] = []
    checked = 0
    for top in ("public/data", "public/geojson"):
        for p in sorted((ROOT / top).rglob("*")):
            if p.suffix not in (".json", ".geojson") or not p.is_file():
                continue
            try:
                doc = json.loads(p.read_text())
            except Exception:
                continue
            if not isinstance(doc, dict) or "nvdm" not in doc:
                continue
            for s in (doc.get("provenance") or {}).get("sources") or []:
                if not isinstance(s, dict):
                    continue
                sid, have = s.get("id"), s.get("license")
                if not sid or have is None:
                    continue
                if sid not in REG:
                    errs.append(
                        f"{p.relative_to(ROOT)}: source '{sid}' is not in the registry"
                    )
                    continue
                checked += 1
                if REG[sid] != have:
                    errs.append(
                        f"{p.relative_to(ROOT)}: source '{sid}' records "
                        f"{have[:50]!r} but the registry says {REG[sid][:50]!r} - "
                        f"the registry is authoritative for a registered source"
                    )
    return errs, checked


def scope_path_errors() -> tuple[list[str], int]:
    """Where a path names a city, the envelope's scope must be that city.

    The empirical coverage test found a producer could write scope.id "chennai"
    into a Delhi artifact and nothing would notice: the catalogue is derived
    FROM the file, so both agree afterwards, and any registered city id passes
    the enum. An independent expectation is needed, and the file path is the
    one we have.

    Partial by construction: it only fires where the path carries a city id, so
    the Chennai-by-default files (ward-profiles.json and friends) are not
    covered. 142 of 363 artifacts are, which is better than none.
    """
    errs: list[str] = []
    checked = 0
    scopes = json.loads((ROOT / "schemas/nvdm/scopes.json").read_text())["scopes"]
    cities = sorted(
        [k for k, v in scopes.items() if v == "city"], key=len, reverse=True
    )
    for top in ("public/data", "public/geojson"):
        for p in sorted((ROOT / top).rglob("*")):
            if p.suffix not in (".json", ".geojson") or not p.is_file():
                continue
            try:
                doc = json.loads(p.read_text())
            except Exception:
                continue
            if not isinstance(doc, dict) or "nvdm" not in doc:
                continue
            rel = str(p.relative_to(ROOT))
            named = [
                c
                for c in cities
                if re.search(rf"(^|[/_-]){re.escape(c)}([/_.-]|$)", rel)
            ]
            if not named:
                continue
            checked += 1
            sid = (doc.get("scope") or {}).get("id")
            if sid not in named:
                errs.append(
                    f"{rel}: scope.id is {sid!r} but the path names "
                    f"{' or '.join(named)} - one of them is wrong"
                )
    return errs, checked


def inventory() -> None:
    producers: dict[str, list[str]] = {}
    for top in ("public/data", "public/geojson"):
        for p in sorted((ROOT / top).rglob("*")):
            if p.suffix not in (".json", ".geojson") or not p.is_file():
                continue
            try:
                doc = json.loads(p.read_text())
            except Exception:
                continue
            if not isinstance(doc, dict) or "nvdm" not in doc:
                continue
            pb = ((doc.get("provenance") or {}).get("produced_by") or "").strip()
            if pb:
                producers.setdefault(pb.split()[0], []).append(str(p.relative_to(ROOT)))
    print(f"{len(producers)} producers of enveloped artifacts:\n")
    for script, files in sorted(producers.items(), key=lambda kv: -len(kv[1])):
        mark = "regen-diffed" if script in REGEN_COVERED else "static-only"
        print(f"  {len(files):3d} artifacts  [{mark}]  {script}")
    print(
        f"\n{len(REGEN_COVERED)} producers are re-run and diffed in CI. The rest are "
        f"network-, portal- or Earth-Engine-bound and cannot be, which is why the "
        f"licence-literal and determination rules above are static."
    )


def main(argv: list[str]) -> int:
    if "--list" in argv:
        inventory()
        return 0
    errs = python_literal_errors() + ts_literal_errors() + literal_allowlist_errors()
    det_errs, det_ok = determination_errors()
    legacy_errs, legacy_checked = legacy_licence_errors()
    env_errs, env_checked = envelope_destruction_errors()
    lic_errs, lic_checked = envelope_licence_errors()
    scope_errs, scope_checked = scope_path_errors()
    errs += det_errs + legacy_errs + env_errs + lic_errs + scope_errs
    if errs:
        print("generator-drift gate FAILED:")
        for e in errs:
            print(f"  {e}")
        print(
            "\nA second copy of a licence - in a generator, or in a legacy field "
            "beside the envelope - is how the registry and the corpus drifted "
            "apart in the first place."
        )
        return 1
    print(
        f"generator-drift gate OK: no generator hardcodes a registered source's "
        f"licence; {len(det_ok)} rights determinations are emitted by their "
        f"producer; {legacy_checked} legacy licence fields agree with their "
        f"envelope; {env_checked} producers preserve the envelopes they write; "
        f"{lic_checked} envelope licences match the registry; "
        f"{scope_checked} scopes agree with their path"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
