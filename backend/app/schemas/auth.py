from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.links import LinkSet

class LoginRequest(BaseModel):
    login: str = Field(..., min_length=3, max_length=128)
    password: str = Field(..., min_length=1, max_length=72)

    @field_validator("password")
    @classmethod
    def _validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password too long (max 72 bytes)")
        return value


class LoginData(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role_id: int


class LoginResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    data: LoginData
    links: LinkSet = Field(alias="_links")


class RegisterUserRequest(BaseModel):
    login: str = Field(..., min_length=3, max_length=128)
    password: str = Field(..., min_length=6, max_length=72)
    role_id: int = Field(..., ge=1)

    @field_validator("password")
    @classmethod
    def _validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password too long (max 72 bytes)")
        return value


class RegisterUserData(BaseModel):
    user_id: str
    role_id: int
    status: str


class RegisterUserResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: RegisterUserData
    links: LinkSet = Field(alias="_links")