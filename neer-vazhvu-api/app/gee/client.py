from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import get_settings

_EE_STATE: dict[str, Any] = {"initialized": False, "project": None}


def _load_service_account_from_file(path: str) -> tuple[str, str]:
    key_path = Path(path).expanduser().resolve()
    if not key_path.exists():
        raise RuntimeError(f"GEE service account file not found: {key_path}")

    data = json.loads(key_path.read_text(encoding="utf-8"))
    client_email = data.get("client_email")
    if not client_email:
        raise RuntimeError("GEE service account file is missing client_email")

    return client_email, str(key_path)


def _load_service_account_from_json(raw_json: str) -> tuple[str, str]:
    data = json.loads(raw_json)
    client_email = data.get("client_email")
    if not client_email:
        raise RuntimeError("GEE service account JSON is missing client_email")
    return client_email, raw_json


def initialize_earth_engine(*, force: bool = False):
    """Initialize the Earth Engine client from environment-backed settings."""
    settings = get_settings()

    if not settings.gee_cloud_project:
        raise RuntimeError("GEE_CLOUD_PROJECT is required for Earth Engine access")

    if (
        _EE_STATE["initialized"]
        and _EE_STATE["project"] == settings.gee_cloud_project
        and not force
    ):
        import ee

        return ee

    import ee

    if settings.gee_service_account_file:
        service_account, key_file = _load_service_account_from_file(
            settings.gee_service_account_file
        )
        credentials = ee.ServiceAccountCredentials(service_account, key_file=key_file)
    elif settings.gee_service_account_json:
        service_account, key_data = _load_service_account_from_json(
            settings.gee_service_account_json
        )
        credentials = ee.ServiceAccountCredentials(service_account, key_data=key_data)
    else:
        raise RuntimeError(
            "Provide either GEE_SERVICE_ACCOUNT_FILE or GEE_SERVICE_ACCOUNT_JSON"
        )

    try:
        ee.Initialize(credentials=credentials, project=settings.gee_cloud_project)
    except Exception as exc:  # pragma: no cover - exercised in auth smoke tests
        raise _translate_gee_error(exc) from exc
    _EE_STATE["initialized"] = True
    _EE_STATE["project"] = settings.gee_cloud_project
    return ee


def check_auth() -> dict[str, str]:
    """Run a tiny Earth Engine request to verify auth and project setup."""
    ee = initialize_earth_engine(force=True)
    try:
        value = ee.Number(1).getInfo()
    except Exception as exc:  # pragma: no cover - exercised in auth smoke tests
        raise _translate_gee_error(exc) from exc
    if value != 1:
        raise RuntimeError(f"Unexpected Earth Engine probe response: {value!r}")

    settings = get_settings()
    return {
        "project": settings.gee_cloud_project or "",
        "status": "ok",
    }


def _translate_gee_error(exc: Exception) -> RuntimeError:
    message = str(exc)
    if "earthengine.computations.create" in message:
        return RuntimeError(
            "Earth Engine credentials reached Google, but the project or service "
            "account lacks Earth Engine compute permission. Verify that "
            "GEE_CLOUD_PROJECT is Earth Engine-enabled and that the service "
            "account has the required Earth Engine access."
        )
    return RuntimeError(f"Earth Engine auth failed: {message}")
