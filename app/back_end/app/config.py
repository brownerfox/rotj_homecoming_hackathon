from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# app/back_end/ — paths are resolved from here so the server finds the same .env and
# database no matter which directory it is started from.
BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """App configuration. Each field can be overridden by an environment variable of the
    same name (case-insensitive) or by a line in app/back_end/.env."""

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str = f"sqlite:///{BACKEND_DIR / 'calibrate.db'}"
    # Browser origins allowed to call the API: the Lovable dev server (8080) and Vite's default (5173).
    cors_origins: list[str] = ["http://localhost:8080", "http://localhost:5173"]


settings = Settings()
