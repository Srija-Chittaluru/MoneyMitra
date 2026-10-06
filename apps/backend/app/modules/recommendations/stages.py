from datetime import date
from enum import StrEnum


class LifeStage(StrEnum):
    CAREER_START = "career_start"
    MID_CAREER = "mid_career"
    PRE_RETIREMENT = "pre_retirement"


STAGE_LABELS: dict[LifeStage, str] = {
    LifeStage.CAREER_START: "Career Start",
    LifeStage.MID_CAREER: "Mid-Career",
    LifeStage.PRE_RETIREMENT: "Pre-Retirement",
}

# Lower age bound (inclusive) at which each later stage begins. Career Start
# is everything below MID_CAREER_FROM_AGE. Change these to move the buckets.
MID_CAREER_FROM_AGE = 30
PRE_RETIREMENT_FROM_AGE = 50


def calculate_age(date_of_birth: date, today: date) -> int:
    """Completed years of age on `today`."""
    return today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))


def resolve_life_stage(age: int) -> LifeStage:
    if age >= PRE_RETIREMENT_FROM_AGE:
        return LifeStage.PRE_RETIREMENT
    if age >= MID_CAREER_FROM_AGE:
        return LifeStage.MID_CAREER
    return LifeStage.CAREER_START
