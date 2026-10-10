"""Stable values stored for goals. Display labels belong to the client, not here."""

from enum import StrEnum


class GoalType(StrEnum):
    EFUND = "efund"
    CAR = "car"
    HOUSE = "house"
    TRAVEL = "travel"
    STUDY = "study"
    MARRIAGE = "marriage"
    FAMILY = "family"
    BUSINESS = "business"
    RETIRE = "retire"
    WEALTH = "wealth"
    DEBT = "debt"
    CUSTOM = "custom"


class GoalStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    # Hidden from the goal list but kept, with its contributions: a goal with
    # recorded contributions can't be deleted.
    ARCHIVED = "archived"
