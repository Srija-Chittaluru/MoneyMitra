from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, populated from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "MoneyMitra API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"

    database_url: str = "postgresql+psycopg://moneymitra:moneymitra@localhost:5432/moneymitra"

    cors_origins: list[str] = ["http://localhost:3000"]

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"

    refresh_cookie_name: str = "refresh_token"
    # Must be "/", not an auth-only prefix: the frontend and backend are
    # separate origins that only share the "localhost" host in dev, and the
    # frontend's proxy (src/proxy.ts) needs to see this cookie on its own
    # routes (e.g. /dashboard), which share nothing with the backend's own
    # URL structure. A path scoped to /api/v1/auth is only ever sent back
    # to the backend itself, so the frontend's presence-check never fires.
    refresh_cookie_path: str = "/"

    @property
    def refresh_cookie_secure(self) -> bool:
        return self.environment == "production"

    @property
    def refresh_cookie_samesite(self) -> str:
        return "lax"


@lru_cache
def get_settings() -> Settings:
    return Settings()
