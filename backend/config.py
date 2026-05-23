from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173"]
    COOKIE_SECURE: bool = False
    GOOGLE_CLIENT_ID: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
