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


class ResidentCreate(BaseModel):
    name: str | None = None
    nome: str | None = None
    whatsapp: str | None = None
    telefone: str | None = None
    email: str
    neighborhood: str | None = None
    bairro: str | None = None
    street: str | None = None
    rua: str | None = None
    consent: bool | None = None
    consentimento: bool | None = None


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


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=1, max_length=255)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str):
        value = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Informe um e-mail valido.")
        return value


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
    sensor_id: int | None = None
    sensor_code: str | None = None
    reason: str = Field(min_length=1)
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
    latitude: float
    longitude: float
    capacity: int
    occupancy: int
    active: bool
