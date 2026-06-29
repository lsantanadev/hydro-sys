from datetime import datetime
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class SensorBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    sensor_code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=120)
    neighborhood: str | None = Field(default=None, max_length=120)
    location_description: str | None = Field(default=None, max_length=255)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    threshold_yellow: float = Field(gt=0)
    threshold_orange: float = Field(gt=0)
    threshold_red: float = Field(gt=0)

    @field_validator("sensor_code")
    @classmethod
    def validate_sensor_code(cls, value: str):
        if not re.fullmatch(r"[A-Za-z0-9_-]+", value):
            raise ValueError("sensor_code deve conter apenas letras, numeros, hifen ou underscore.")
        return value

    @field_validator("neighborhood", "location_description")
    @classmethod
    def empty_optional_text_to_none(cls, value: str | None):
        return value or None

    @model_validator(mode="after")
    def validate_thresholds(self):
        if not (self.threshold_yellow < self.threshold_orange < self.threshold_red):
            raise ValueError("Os limiares precisam seguir amarelo < laranja < vermelho.")
        return self


class SensorCreate(SensorBase):
    pass


class SensorUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=120)
    neighborhood: str | None = Field(default=None, max_length=120)
    location_description: str | None = Field(default=None, max_length=255)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    threshold_yellow: float | None = Field(default=None, gt=0)
    threshold_orange: float | None = Field(default=None, gt=0)
    threshold_red: float | None = Field(default=None, gt=0)
    active: bool | None = None

    @field_validator("neighborhood", "location_description")
    @classmethod
    def empty_optional_text_to_none(cls, value: str | None):
        return value or None


class SensorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sensor_code: str
    name: str
    neighborhood: str | None
    location_description: str | None
    latitude: float
    longitude: float
    threshold_yellow: float
    threshold_orange: float
    threshold_red: float
    current_level: float
    current_status: str
    active: bool
    last_reading_at: datetime | None
    last_reading_is_valid: bool | None = None
    last_reading_origin: str | None = None
    last_discarded_at: datetime | None = None
    created_at: datetime


class ReadingCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    sensor_code: str = Field(min_length=1, max_length=50)
    water_level_cm: float
    origin: str = Field(min_length=1, max_length=30)


class ReadingOut(BaseModel):
    id: int
    sensor_code: str
    water_level_cm: float
    status_generated: str
    origin: str
    is_valid: bool
    created_at: datetime


class LatestReadingOut(BaseModel):
    reading: ReadingOut | None
    latest_received_reading: ReadingOut | None
    latest_reading_discarded: bool


class MapSensorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    neighborhood: str | None
    latitude: float
    longitude: float
    current_level: float
    current_status: str
    last_reading_at: datetime | None


class MapShelterOut(BaseModel):
    id: int
    name: str
    address: str | None = None
    latitude: float
    longitude: float
    capacity: int
    occupancy: int
    available_spots: int


class ResidentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)
    whatsapp: str = Field(min_length=8, max_length=30)
    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=8, max_length=255)
    neighborhood: str = Field(min_length=1, max_length=120)
    street: str = Field(min_length=1, max_length=200)
    consent: bool

    @field_validator("whatsapp")
    @classmethod
    def validate_whatsapp(cls, value: str):
        digits = re.sub(r"\D", "", value)
        if digits.startswith("55") and len(digits) in (12, 13):
            digits = digits[2:]
        if not re.fullmatch(r"[1-9][0-9](?:9[0-9]{8}|[2-9][0-9]{7})", digits):
            raise ValueError("Informe um WhatsApp brasileiro com DDD. Exemplo: (48) 99999-9999.")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str):
        value = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Informe um e-mail valido.")
        return value


class ResidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    whatsapp: str
    email: str
    neighborhood: str
    street: str
    consent_at: datetime
    created_at: datetime


class ResidentCountOut(BaseModel):
    count: int


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=1, max_length=255)
    role: str = Field(default="OPERATOR", min_length=1, max_length=30)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str):
        value = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Informe um e-mail valido.")
        return value

    @field_validator("role")
    @classmethod
    def normalize_role(cls, value: str):
        role = value.strip().upper()
        if role == "OPERADOR":
            return "OPERATOR"
        if role not in {"OPERATOR", "MORADOR"}:
            raise ValueError("Perfil de login invalido.")
        return role


class AuthUserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserOut


class ManualOccurrenceCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    sensor_id: int | None = None
    sensor_code: str | None = None
    reason: str = Field(min_length=1)
    operator: str | None = Field(default=None, min_length=1, max_length=120)
    actor: str = Field(default="operador", min_length=1, max_length=120)


class ManualOccurrenceClose(BaseModel):
    actor: str = Field(default="operador", min_length=1, max_length=120)


class ManualOccurrenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sensor_id: int
    sensor_code: str
    status: str
    reason: str
    operator: str
    active: bool
    closed_at: datetime | None
    closed_by: str | None
    created_at: datetime


class AuditOut(BaseModel):
    id: int
    usuario: str
    acao: str
    entidade: str
    detalhe: str | None
    data_hora: datetime


class ShelterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: str | None
    latitude: float
    longitude: float
    capacity: int
    occupancy: int
    active: bool
