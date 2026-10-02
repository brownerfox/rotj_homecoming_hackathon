from pathlib import Path
from typing import Literal

from pydantic import SecretStr
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

    # SecretStr keeps the key out of logs and error messages.
    anthropic_api_key: SecretStr | None = None
    # About 7 cents per resume. If the budget gets tight, claude-sonnet-5-5 costs half as much per token.
    claude_model: str = "claude-opus-5-5"
    # How hard Claude thinks before answering. Higher is slower and costs more output tokens.
    claude_effort: Literal["low", "medium", "high", "xhigh", "max"] = "medium"
    # How many resumes are sent to Claude at once during a bulk upload.
    generation_concurrency: int = 3

    @property
    def api_key(self) -> str | None:
        """The key, or None if it's unset or blank (as in a freshly copied .env.example)."""
        return (self.anthropic_api_key.get_secret_value() if self.anthropic_api_key else None) or None


settings = Settings()
