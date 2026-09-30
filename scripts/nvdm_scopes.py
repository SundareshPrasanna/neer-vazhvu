"""The one Python reader of the NVDM scope registry (schemas/nvdm/scopes.json).

Scope ids are opaque names and are never parsed: hierarchy lives in each
entry's typed relations, external identities in its refs. Every function
takes an optional `scopes` map so the validator can probe a modified registry.
TypeScript twin: src/lib/scopes.ts.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

REGISTRY = Path(__file__).resolve().parents[1] / "schemas/nvdm/scopes.json"
WATER_KINDS = ("basin", "waterway", "body")
PARENT = "administrative-parent"


@lru_cache(maxsize=1)
def load() -> dict[str, dict]:
    return json.loads(REGISTRY.read_text())["scopes"]


def ids(*kinds: str, scopes: dict | None = None) -> list[str]:
    """Registered ids in registry order, optionally of the given kinds."""
    s = scopes or load()
    return [sid for sid, e in s.items() if not kinds or e.get("kind") in kinds]


def kind(sid: str, scopes: dict | None = None) -> str | None:
    return (scopes or load()).get(sid, {}).get("kind")


def refs(sid: str, system: str | None = None, scopes: dict | None = None) -> list[dict]:
    return [r for r in (scopes or load()).get(sid, {}).get("refs", []) if system in (None, r.get("system"))]


def related(sid: str, rel: str, scopes: dict | None = None) -> list[str]:
    return [r.get("target") for r in (scopes or load()).get(sid, {}).get("relations", []) if r.get("type") == rel]


def ancestors(sid: str, rel: str = PARENT, scopes: dict | None = None) -> list[str]:
    """Every scope reachable over `rel`, nearest first; `sid` appears only on a cycle."""
    out: list[str] = []
    todo = related(sid, rel, scopes)
    while todo:
        t = todo.pop(0)
        if t not in out:
            out.append(t)
            todo += related(t, rel, scopes)
    return out


def countries(sid: str, scopes: dict | None = None) -> set[str]:
    """Places walk administrative-parent; water systems go through the places they intersect."""
    via = related(sid, "intersects", scopes) if kind(sid, scopes) in WATER_KINDS else [sid]
    return {a for v in via for a in (v, *ancestors(v, PARENT, scopes)) if kind(a, scopes) == "country"}


def country(sid: str, scopes: dict | None = None) -> str | None:
    """The one country a scope sits in, or None when it has none or crosses a border."""
    found = countries(sid, scopes)
    return found.pop() if len(found) == 1 else None
