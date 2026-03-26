from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    supabase_url: str
    supabase_service_key: str
    cron_secret: str
    environment: str = "development"
    data_gov_in_api_key: str | None = None

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    """Lazy-load settings so the app can import without env vars at module level."""
    return Settings()
