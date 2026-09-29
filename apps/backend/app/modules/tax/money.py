from decimal import ROUND_HALF_UP, Decimal


def round_to_nearest_10(amount: Decimal) -> Decimal:
    """Sections 288A/288B: total income and final tax payable are both
    rounded to the nearest multiple of 10 rupees."""
    return (amount / 10).quantize(Decimal("1"), rounding=ROUND_HALF_UP) * 10
