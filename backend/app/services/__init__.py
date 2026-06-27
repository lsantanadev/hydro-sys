import json
from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditEvent


def log_audit(
    db: Session,
    actor: str,
    action: str,
    entity: str,
    details: Any | None = None,
) -> AuditEvent:
    event = AuditEvent(
        actor=required_text(actor, "sistema"),
        action=required_text(action, "ACAO_NAO_INFORMADA"),
        entity=required_text(entity, "entidade"),
        details=serialize_details(details),
    )
    db.add(event)
    return event


def required_text(value: str | None, fallback: str) -> str:
    text = str(value or "").strip()
    return text or fallback


def serialize_details(details: Any | None) -> str | None:
    if details is None:
        return None
    if isinstance(details, str):
        return details
    return json.dumps(details, ensure_ascii=False, sort_keys=True, default=str)
