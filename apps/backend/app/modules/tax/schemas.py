from datetime import date
from typing import Literal

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
    home_loan_interest: int = Field(default=0, ge=0, description="Section 24(b)")
    nps_contribution: int = Field(default=0, ge=0, description="Section 80CCD(1B)")
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


class DeductionSectionBreakdown(BaseModel):
    section: str
    label: str
    limit: int | None = Field(default=None, description="None where there is no flat cap (e.g. HRA)")
    declared_amount: int
    headroom: int | None = Field(default=None, description="None where headroom isn't computable (e.g. HRA)")
    qualifying_instruments: list[str]
    note: str | None = None


class TaxComparisonResult(BaseModel):
    tax_year: str
    old_regime: RegimeResult
    new_regime: RegimeResult
    recommended_regime: str
    difference: int
    deduction_checklist: list[DeductionSectionBreakdown]


class ExplanationRequest(BaseModel):
    comparison: TaxComparisonResult


class ExplanationResult(BaseModel):
    old_regime_note: str
    new_regime_note: str
    old_regime_disclaimer: str


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    comparison: TaxComparisonResult | None = None
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)


class ChatResponse(BaseModel):
    reply: str
