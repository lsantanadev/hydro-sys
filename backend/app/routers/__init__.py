from datetime import datetime, timezone
import json

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AppUser, AuditEvent, ManualOccurrence, Resident, Sensor, SensorReading, Shelter
from app.schemas import (
    AuditOut,
    AuthUserOut,
    LoginRequest,
    LoginResponse,
    LatestReadingOut,
    MapSensorOut,
    MapShelterOut,
    ManualOccurrenceClose,
    ManualOccurrenceCreate,
    ManualOccurrenceOut,
    ReadingCreate,
    ReadingOut,
    ResidentCreate,
    ResidentOut,
    SensorCreate,
    SensorOut,
    SensorUpdate,
    ShelterOut,
)
from app.security import create_access_token, decode_access_token, verify_password
from app.services import audit


router = APIRouter(prefix="/api")
bearer_scheme = HTTPBearer(auto_error=False)


def status_by_level(sensor: Sensor, level: float) -> str:
    if level >= float(sensor.threshold_red):
        return "vermelho"
    if level >= float(sensor.threshold_orange):
        return "laranja"
    if level >= float(sensor.threshold_yellow):
        return "amarelo"
    return "verde"


def sensor_or_404(db: Session, sensor_id: int) -> Sensor:
    sensor = db.get(Sensor, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor não encontrado.")
    return sensor


def sensor_by_code_or_404(db: Session, sensor_code: str) -> Sensor:
    sensor = db.scalar(select(Sensor).where(Sensor.sensor_code == sensor_code.upper()))
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor não cadastrado.")
    return sensor


def reading_payload(payload: ReadingCreate) -> tuple[str, float, str]:
    sensor_code = payload.sensor_code.strip().upper()
    level = payload.water_level_cm
    origin = payload.origin.strip().upper()
    if not sensor_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="sensor_code é obrigatório.")
    if not origin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="origin é obrigatório.")
    if level is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="water_level_cm é obrigatório.")
    try:
        parsed_level = round(float(level), 2)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="water_level_cm deve ser numerico.") from None
    if parsed_level < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="water_level_cm não pode ser negativo.")
    return sensor_code, parsed_level, origin


def serialize_sensor(sensor: Sensor, last_reading: SensorReading | None = None) -> SensorOut:
    sensor_out = SensorOut.model_validate(sensor)
    if last_reading:
        sensor_out.last_reading_is_valid = bool(last_reading.is_valid)
        sensor_out.last_discarded_at = last_reading.created_at if not last_reading.is_valid else None
    return sensor_out


def serialize_reading(reading: SensorReading, sensor: Sensor) -> ReadingOut:
    return ReadingOut(
        id=reading.id,
        sensor_code=sensor.sensor_code,
        water_level_cm=float(reading.water_level_cm),
        status_generated=reading.status_generated,
        origin=reading.origin,
        is_valid=reading.is_valid,
        created_at=reading.created_at,
    )


def serialize_manual_occurrence(
    occurrence: ManualOccurrence,
    sensor: Sensor,
) -> ManualOccurrenceOut:
    return ManualOccurrenceOut(
        id=occurrence.id,
        sensor_id=occurrence.sensor_id,
        sensor_code=sensor.sensor_code,
        status=occurrence.status,
        reason=occurrence.reason,
        operator=occurrence.operator,
        closed_at=occurrence.closed_at,
        closed_by=occurrence.closed_by,
        created_at=occurrence.created_at,
    )


def has_open_manual_occurrence(db: Session, sensor_id: int) -> bool:
    return db.scalar(
        select(ManualOccurrence.id)
        .where(
            ManualOccurrence.sensor_id == sensor_id,
            ManualOccurrence.closed_at.is_(None),
        )
        .limit(1)
    ) is not None


def reading_filter_result(db: Session, sensor_id: int, level: float) -> dict:
    previous_levels = db.scalars(
        select(SensorReading.water_level_cm)
        .where(
            SensorReading.sensor_id == sensor_id,
            SensorReading.is_valid.is_(True),
        )
        .order_by(SensorReading.created_at.desc(), SensorReading.id.desc())
        .limit(3)
    ).all()
    if len(previous_levels) < 3:
        return {
            "is_valid": True,
            "previous_count": len(previous_levels),
            "average": None,
            "variation_percent": None,
        }
    previous_values = [float(value) for value in previous_levels]
    average = sum(previous_values) / 3
    if average <= 0:
        return {
            "is_valid": True,
            "previous_count": len(previous_values),
            "average": round(average, 2),
            "variation_percent": None,
        }
    variation_percent = abs(level - average) / average
    return {
        "is_valid": variation_percent <= 0.5,
        "previous_count": len(previous_values),
        "average": round(average, 2),
        "variation_percent": round(variation_percent * 100, 2),
    }


def latest_valid_reading(db: Session, sensor_id: int) -> SensorReading | None:
    return db.scalar(
        select(SensorReading)
        .where(
            SensorReading.sensor_id == sensor_id,
            SensorReading.is_valid.is_(True),
        )
        .order_by(SensorReading.created_at.desc(), SensorReading.id.desc())
        .limit(1)
    )


def latest_sensor_reading(db: Session, sensor_id: int) -> SensorReading | None:
    return db.scalar(
        select(SensorReading)
        .where(SensorReading.sensor_id == sensor_id)
        .order_by(SensorReading.created_at.desc(), SensorReading.id.desc())
        .limit(1)
    )


def audit_payload(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def operator_out(user: AppUser) -> AuthUserOut:
    return AuthUserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
    )


def unauthorized_login() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="E-mail ou senha invalidos.",
    )


def require_operator(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AppUser:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticacao obrigatoria.")
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao invalida ou expirada.")
    if payload.get("role") != "OPERATOR":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito ao operador.")
    try:
        user_id = int(payload.get("sub", 0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao invalida.") from None
    user = db.get(AppUser, user_id)
    if not user or not user.active or user.role != "OPERATOR":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Operador inativo ou inexistente.")
    return user


@router.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("select 1"))
    return {"status": "ok", "database": "postgresql"}


@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(
        select(AppUser).where(
            func.lower(AppUser.email) == payload.email,
            AppUser.role == "OPERATOR",
            AppUser.active.is_(True),
        )
    )
    if not user or not verify_password(payload.password, user.password_hash):
        raise unauthorized_login()
    user.last_login_at = datetime.now(timezone.utc)
    audit(db, user.email, "LOGIN_OPERADOR", "auth")
    db.commit()
    return LoginResponse(
        access_token=create_access_token(str(user.id), user.role),
        user=operator_out(user),
    )


@router.get("/auth/me", response_model=AuthUserOut)
def me(operator: AppUser = Depends(require_operator)):
    return operator_out(operator)


@router.post("/sensors", response_model=SensorOut, status_code=status.HTTP_201_CREATED)
def create_sensor(payload: SensorCreate, db: Session = Depends(get_db), operator: AppUser = Depends(require_operator)):
    code = payload.sensor_code.strip().upper()
    if db.scalar(select(Sensor).where(Sensor.sensor_code == code)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe sensor com este código.")
    sensor = Sensor(
        sensor_code=code,
        name=payload.name.strip(),
        neighborhood=payload.neighborhood,
        location_description=payload.location_description,
        latitude=payload.latitude,
        longitude=payload.longitude,
        threshold_yellow=payload.threshold_yellow,
        threshold_orange=payload.threshold_orange,
        threshold_red=payload.threshold_red,
        current_level=0,
        current_status="verde",
        active=True,
    )
    db.add(sensor)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe sensor com este código.") from None
    audit(db, operator.email, "SENSOR_CRIADO", sensor.sensor_code, sensor.name)
    db.commit()
    db.refresh(sensor)
    return serialize_sensor(sensor)


@router.get("/sensors", response_model=list[SensorOut])
def list_sensors(db: Session = Depends(get_db)):
    sensors = db.scalars(select(Sensor).order_by(Sensor.id)).all()
    return [serialize_sensor(sensor, latest_sensor_reading(db, sensor.id)) for sensor in sensors]


@router.put("/sensors/{sensor_id}", response_model=SensorOut)
def update_sensor(
    sensor_id: int,
    payload: SensorUpdate,
    db: Session = Depends(get_db),
    operator: AppUser = Depends(require_operator),
):
    sensor = sensor_or_404(db, sensor_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe ao menos um campo para atualizar.")
    threshold_fields = ("threshold_yellow", "threshold_orange", "threshold_red")
    previous_thresholds = {
        "threshold_yellow": float(sensor.threshold_yellow),
        "threshold_orange": float(sensor.threshold_orange),
        "threshold_red": float(sensor.threshold_red),
    }
    yellow = data.get("threshold_yellow", float(sensor.threshold_yellow))
    orange = data.get("threshold_orange", float(sensor.threshold_orange))
    red = data.get("threshold_red", float(sensor.threshold_red))
    new_thresholds = {
        "threshold_yellow": float(yellow),
        "threshold_orange": float(orange),
        "threshold_red": float(red),
    }
    if min(new_thresholds.values()) <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Os limiares precisam ser maiores que zero.")
    if not (yellow < orange < red):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Os limiares precisam seguir amarelo < laranja < vermelho.")
    threshold_changes = {
        field: {
            "anterior": previous_thresholds[field],
            "novo": new_thresholds[field],
        }
        for field in threshold_fields
        if previous_thresholds[field] != new_thresholds[field]
    }
    for field, value in data.items():
        setattr(sensor, field, value)
    sensor.current_status = status_by_level(sensor, float(sensor.current_level))
    audit(db, operator.email, "SENSOR_ATUALIZADO", sensor.sensor_code, audit_payload(data))
    if threshold_changes:
        audit(
            db,
            operator.email,
            "LIMIARES_ALTERADOS",
            sensor.sensor_code,
            audit_payload(
                {
                    "alterados": threshold_changes,
                    "antes": previous_thresholds,
                    "depois": new_thresholds,
                }
            ),
        )
    db.commit()
    db.refresh(sensor)
    return serialize_sensor(sensor)


@router.delete("/sensors/{sensor_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_sensor(sensor_id: int, db: Session = Depends(get_db), operator: AppUser = Depends(require_operator)):
    sensor = sensor_or_404(db, sensor_id)
    if not sensor.active:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    sensor.active = False
    audit(db, operator.email, "SENSOR_DESATIVADO", sensor.sensor_code)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/sensors/readings", response_model=ReadingOut, status_code=status.HTTP_201_CREATED)
def receive_reading(payload: ReadingCreate, db: Session = Depends(get_db)):
    return _receive_reading(payload, db)


def _receive_reading(payload: ReadingCreate, db: Session) -> ReadingOut:
    sensor_code, level, origin = reading_payload(payload)
    sensor = sensor_by_code_or_404(db, sensor_code)
    if not sensor.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sensor inativo.")
    old_status = sensor.current_status
    filter_result = reading_filter_result(db, sensor.id, level)
    is_valid = filter_result["is_valid"]
    new_status = status_by_level(sensor, level)
    now = datetime.now(timezone.utc)
    reading = SensorReading(
        sensor_id=sensor.id,
        water_level_cm=level,
        origin=origin,
        status_generated=new_status,
        is_valid=is_valid,
        created_at=now,
    )
    sensor.last_reading_at = now
    if is_valid:
        sensor.current_level = level
        if not has_open_manual_occurrence(db, sensor.id):
            sensor.current_status = new_status
    db.add(reading)
    db.flush()
    if is_valid:
        audit(db, origin, "LEITURA_SENSOR_RECEBIDA", sensor.sensor_code, f"{level} cm - {new_status}")
        if old_status != sensor.current_status:
            audit(
                db,
                "sistema",
                "STATUS_SENSOR_ALTERADO",
                sensor.sensor_code,
                f"{old_status} para {sensor.current_status}",
            )
    else:
        audit(
            db,
            origin,
            "LEITURA_DESCARTADA",
            sensor.sensor_code,
            audit_payload(
                {
                    "water_level_cm": level,
                    "media_ultimas_3_validas": filter_result["average"],
                    "variacao_percentual": filter_result["variation_percent"],
                    "limite_percentual": 50,
                    "leituras_validas_consideradas": filter_result["previous_count"],
                }
            ),
        )
    db.commit()
    db.refresh(reading)
    return serialize_reading(reading, sensor)


@router.get("/sensors/{sensor_id}/latest-reading", response_model=LatestReadingOut)
def latest_reading(sensor_id: int, db: Session = Depends(get_db)):
    sensor = sensor_or_404(db, sensor_id)
    reading = latest_valid_reading(db, sensor.id)
    latest_received_reading = latest_sensor_reading(db, sensor.id)
    return LatestReadingOut(
        reading=serialize_reading(reading, sensor) if reading else None,
        latest_received_reading=serialize_reading(latest_received_reading, sensor) if latest_received_reading else None,
        latest_reading_discarded=bool(latest_received_reading and not latest_received_reading.is_valid),
    )


@router.get("/map/sensors", response_model=list[MapSensorOut])
def map_sensors(db: Session = Depends(get_db)):
    sensors = db.scalars(select(Sensor).where(Sensor.active.is_(True)).order_by(Sensor.id)).all()
    return sensors


@router.get("/map/shelters", response_model=list[MapShelterOut])
def map_shelters(db: Session = Depends(get_db)):
    shelters = db.scalars(select(Shelter).where(Shelter.active.is_(True)).order_by(Shelter.id)).all()
    return [
        MapShelterOut(
            id=shelter.id,
            name=shelter.name,
            latitude=shelter.latitude,
            longitude=shelter.longitude,
            capacity=shelter.capacity,
            occupancy=shelter.occupancy,
            available_spots=max(0, shelter.capacity - shelter.occupancy),
        )
        for shelter in shelters
    ]


@router.post(
    "/manual-occurrences",
    response_model=ManualOccurrenceOut,
    status_code=status.HTTP_201_CREATED,
)
def create_manual_occurrence(
    payload: ManualOccurrenceCreate,
    db: Session = Depends(get_db),
    operator: AppUser = Depends(require_operator),
):
    if payload.sensor_id:
        sensor = sensor_or_404(db, payload.sensor_id)
    elif payload.sensor_code:
        sensor = sensor_by_code_or_404(db, payload.sensor_code)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe sensor_id ou sensor_code.")
    if has_open_manual_occurrence(db, sensor.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe uma ocorrência manual aberta para este sensor.",
        )
    actor = operator.email
    occurrence = ManualOccurrence(
        sensor_id=sensor.id,
        status="vermelho",
        reason=payload.reason.strip(),
        operator=actor,
    )
    sensor.current_status = "vermelho"
    db.add(occurrence)
    db.flush()
    audit(db, actor, "OCORRENCIA_MANUAL_CRIADA", sensor.sensor_code, occurrence.reason)
    db.commit()
    db.refresh(occurrence)
    return serialize_manual_occurrence(occurrence, sensor)


@router.put(
    "/manual-occurrences/{occurrence_id}/close",
    response_model=ManualOccurrenceOut,
)
def close_manual_occurrence(
    occurrence_id: int,
    payload: ManualOccurrenceClose,
    db: Session = Depends(get_db),
    operator: AppUser = Depends(require_operator),
):
    occurrence = db.get(ManualOccurrence, occurrence_id)
    if not occurrence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ocorrência manual não encontrada.",
        )
    if occurrence.closed_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A ocorrência manual ja foi encerrada.",
        )
    sensor = sensor_or_404(db, occurrence.sensor_id)
    actor = operator.email
    now = datetime.now(timezone.utc)
    occurrence.status = "encerrado"
    occurrence.closed_at = now
    occurrence.closed_by = actor

    reading = latest_valid_reading(db, sensor.id)
    if reading:
        sensor.current_level = float(reading.water_level_cm)
        sensor.current_status = status_by_level(sensor, float(reading.water_level_cm))
    else:
        sensor.current_level = 0
        sensor.current_status = "verde"

    audit(
        db,
        actor,
        "OCORRENCIA_MANUAL_ENCERRADA",
        sensor.sensor_code,
        f"Status restaurado para {sensor.current_status}",
    )
    db.commit()
    db.refresh(occurrence)
    return serialize_manual_occurrence(occurrence, sensor)


@router.post("/residents", response_model=ResidentOut, status_code=status.HTTP_201_CREATED)
def create_resident(payload: ResidentCreate, db: Session = Depends(get_db)):
    consent = payload.consent if payload.consent is not None else payload.consentimento
    if consent is not True:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Consentimento LGPD obrigatério.")
    name = (payload.name or payload.nome or "").strip()
    whatsapp = (payload.whatsapp or payload.telefone or "").strip()
    neighborhood = (payload.neighborhood or payload.bairro or "").strip()
    street = (payload.street or payload.rua or "").strip()
    if not all([name, whatsapp, payload.email, neighborhood, street]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Preencha nome, WhatsApp, e-mail, bairro e rua.")
    resident = Resident(
        name=name,
        whatsapp=whatsapp,
        email=payload.email.strip().lower(),
        neighborhood=neighborhood,
        street=street,
        consent_at=datetime.now(timezone.utc),
    )
    db.add(resident)
    db.flush()
    audit(db, "morador", "MORADOR_CADASTRADO", str(resident.id), resident.email)
    db.commit()
    db.refresh(resident)
    return resident


@router.get("/residents", response_model=list[ResidentOut])
def list_residents(db: Session = Depends(get_db), operator: AppUser = Depends(require_operator)):
    return db.scalars(select(Resident).order_by(Resident.id.desc()).limit(250)).all()


@router.get("/audit", response_model=list[AuditOut])
def list_audit(db: Session = Depends(get_db), operator: AppUser = Depends(require_operator)):
    events = db.scalars(select(AuditEvent).order_by(AuditEvent.id.desc()).limit(250)).all()
    return [
        AuditOut(
            id=event.id,
            usuario=event.actor,
            acao=event.action,
            entidade=event.entity,
            detalhe=event.details,
            data_hora=event.created_at,
        )
        for event in events
    ]
