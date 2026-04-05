from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings

API_ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = API_ROOT / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    supabase_url: str
    supabase_service_key: str
    cron_secret: str
    environment: str = "development"
    data_gov_in_api_key: str | None = None
    gee_cloud_project: str | None = None
    gee_service_account_file: str | None = None
    gee_service_account_json: str | None = None

    model_config = {
        "env_file": str(ENV_FILE),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    """Lazy-load settings so the app can import without env vars at module level."""
    return Settings()
