from enum import IntEnum


class Level(IntEnum):
    """How much we know about the user. Each level builds on the one below."""

    NONE = 0  # no usable profile yet (no date of birth)
    PROFILE = 1  # date of birth, plus optionally employee category / expected income
    DECLARED = 2  # actual income and deductions from the ITR draft or a tax comparison
    DOCUMENTS = 3  # analysis of uploaded Form 16 / AIS / payslips


LEVEL_LABELS: dict[Level, str] = {
    Level.NONE: "Getting started",
    Level.PROFILE: "Profile",
    Level.DECLARED: "Your income",
    Level.DOCUMENTS: "Your documents",
}
