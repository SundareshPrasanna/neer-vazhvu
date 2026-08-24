"""Shared Supabase upload for rich-body raster assets.

The imagery ingest has always been able to publish its yearly chips
(`--upload`); the two tint scripts never could, so `tints.*.public_url`
was written as null and the cumulative water-loss / built-gain overlays
had no URL for the panel to render. The handful of bodies that do show
tints today got their URLs out of band, which meant the tint half of the
pipeline could not be reproduced from the committed scripts.

Same bucket, same path convention, one implementation.
"""
from __future__ import annotations

import os

SATELLITE_EVIDENCE_BUCKET = "satellite-evidence"


def upload_supabase(remote_path: str, data: bytes, content_type: str) -> str:
    """Upsert `data` at `remote_path` in the evidence bucket, return its public URL."""
    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    sb = create_client(url, key)
    bucket = sb.storage.from_(SATELLITE_EVIDENCE_BUCKET)
    options = {"content-type": content_type, "upsert": "true"}
    try:
        bucket.upload(remote_path, data, options)
    except Exception:
        bucket.update(remote_path, data, options)
    return f"{url}/storage/v1/object/public/{SATELLITE_EVIDENCE_BUCKET}/{remote_path}"
