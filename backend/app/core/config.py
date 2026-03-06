from __future__ import annotations

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _parse_int_list(value: str | list[int] | None) -> list[int]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if not value:
        return []
    return [int(item.strip()) for item in value.split(",") if item.strip()]


def _parse_str_list(value: str | list[str] | None) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [item.strip() for item in value if item and item.strip()]
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    database_url: str = Field(..., validation_alias="DATABASE_URL")
    jwt_secret: str = Field(..., validation_alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")
    jwt_exp_minutes: int = Field(default=60, validation_alias="JWT_EXP_MINUTES")
    superadmin_role_id: int = 1
    admin_role_id: int = 2
    contractor_role_id: int = 3
    project_manager_role_id: int = 4
    lead_economist_role_id: int = 5
    economist_role_id: int = 6
    operator_role_id: int = 7
    tg_link_secret: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TG_LINK_SECRET", "TG_LINK_SALT"),
    )
    public_backend_base_url: str | None = Field(default=None, validation_alias="PUBLIC_BACKEND_BASE_URL")
    web_base_url: str | None = Field(default=None, validation_alias="WEB_BASE_URL")
    tg_register_ttl_seconds: int = Field(default=86400, validation_alias="TG_REGISTER_TTL_SECONDS")
    tg_request_ttl_seconds: int = Field(default=604800, validation_alias="TG_REQUEST_TTL_SECONDS")
    allowed_creation_role_ids: list[int] = Field(default_factory=lambda: [2, 3, 4, 5, 6, 7])
    cors_allow_origins: list[str] = Field(
        default_factory=list,
        validation_alias="CORS_ALLOW_ORIGINS",
    )

    @field_validator("allowed_creation_role_ids", mode="before")
    @classmethod
    def _validate_allowed_creation_role_ids(cls, value: str | list[int] | None) -> list[int]:
        return _parse_int_list(value)
    
    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def _validate_cors_allow_origins(cls, value: str | list[str] | None) -> list[str]:
        return _parse_str_list(value)
    
    @model_validator(mode="after")
    def _enforce_fixed_role_ids(self) -> "Settings":
        # Роли зафиксированы бизнес-схемой БД и не должны переопределяться окружением.
        self.superadmin_role_id = 1
        self.admin_role_id = 2
        self.contractor_role_id = 3
        self.project_manager_role_id = 4
        self.lead_economist_role_id = 5
        self.economist_role_id = 6
        self.operator_role_id = 7
        return self

    @property
    def resolved_cors_allow_origins(self) -> list[str]:
        origins = list(self.cors_allow_origins)
        if self.web_base_url and self.web_base_url not in origins:
            origins.append(self.web_base_url)
        return origins


settings = Settings()
