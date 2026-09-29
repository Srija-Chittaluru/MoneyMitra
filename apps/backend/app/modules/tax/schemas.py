from datetime import date

from pydantic import BaseModel, Field


class TaxComparisonInput(BaseModel):
    tax_year: str = Field(examples=["2025-26"])
    gross_total_income: int = Field(ge=0, description="Total annual income before deductions, in rupees")
    date_of_birth: date | None = Field(default=None, description="Used to select the old-regime age category")

    # Old-regime-only inputs. The new regime does not allow these
    # deductions by law, so they are ignored when calculating it.
    section_80c: int = Field(default=0, ge=0)
    section_80d: int = Field(default=0, ge=0)
    hra_exemption: int = Field(default=0, ge=0)
    other_deductions: int = Field(default=0, ge=0)


class RegimeResult(BaseModel):
    regime: str
    gross_total_income: int
    total_deductions: int
    taxable_income: int
    tax_before_rebate: int
    rebate: int
    tax_after_rebate: int
    surcharge: int
    cess: int
    total_tax_payable: int


class TaxComparisonResult(BaseModel):
    tax_year: str
    old_regime: RegimeResult
    new_regime: RegimeResult
    recommended_regime: str
    difference: int
