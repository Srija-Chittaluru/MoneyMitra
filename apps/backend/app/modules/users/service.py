from datetime import date

from sqlalchemy.orm import Session

from app.modules.users.models import TAX_ONBOARDING_COMPLETED, TAX_ONBOARDING_SKIPPED, User
from app.modules.users.pii import encrypt_pan


def save_tax_profile(db: Session, user: User, pan: str, date_of_birth: date) -> User:
    user.pan_encrypted = encrypt_pan(pan)
    user.date_of_birth = date_of_birth
    user.tax_onboarding_status = TAX_ONBOARDING_COMPLETED
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def skip_tax_onboarding(db: Session, user: User) -> User:
    # Never downgrade: a user who already completed onboarding stays completed.
    if user.tax_onboarding_status is None:
        user.tax_onboarding_status = TAX_ONBOARDING_SKIPPED
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
