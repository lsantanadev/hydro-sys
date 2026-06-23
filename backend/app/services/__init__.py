from sqlalchemy.orm import Session

from app.models import AuditEvent


def audit(db: Session, actor: str, action: str, entity: str, details: str | None = None) -> None:
    db.add(AuditEvent(actor=actor, action=action, entity=entity, details=details))
