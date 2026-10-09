"""Stable values stored for goals. Display labels belong to the client, not here."""

from enum import StrEnum


class GoalType(StrEnum):
    CAR = "car"
    HOUSE = "house"
    VACATION = "vacation"
    EDUCATION = "education"
    EMERGENCY_FUND = "emergency_fund"
    WEDDING = "wedding"
    RETIREMENT = "retirement"
    OTHER = "other"


class GoalStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    # Hidden from the goal list but kept, with its contributions: a goal with
    # recorded contributions can't be deleted.
    ARCHIVED = "archived"
