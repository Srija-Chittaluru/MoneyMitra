from datetime import date

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user, rate_limited_user
from app.modules.documents import service as documents_service
from app.modules.itr import pdf, service
from app.modules.itr.rules import get_itr_rules, get_supported_assessment_years
from app.modules.itr.schemas import AssessmentYearInfo, ItrDraftData, ItrExport, ItrFilingOut, ItrSummary
from app.modules.users.models import User

router = APIRouter(prefix="/itr", tags=["itr"])


def filing_date() -> date:
    """The date the return is assumed to be filed on — drives 139(1) vs
    139(4), regime eligibility and 234A/234B/234F. A dependency so tests can
    override it."""
    return date.today()


@router.get("/assessment-years", response_model=list[AssessmentYearInfo])
def list_assessment_years(current_user: User = Depends(get_current_user)) -> list[AssessmentYearInfo]:
    years = []
    for ay in get_supported_assessment_years():
        rules = get_itr_rules(ay)
        years.append(
            AssessmentYearInfo(
                assessment_year=rules.assessment_year,
                financial_year=rules.financial_year,
                due_date=rules.due_date,
                belated_deadline=rules.belated_deadline,
            )
        )
    return years


@router.get("/filings/{assessment_year}", response_model=ItrFilingOut)
def get_filing(
    assessment_year: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItrFilingOut:
    rules = service.get_rules_or_404(assessment_year)
    return service.to_out(service.get_or_create_filing(db, current_user, rules))


@router.put("/filings/{assessment_year}", response_model=ItrFilingOut)
def save_filing(
    assessment_year: str,
    payload: ItrDraftData,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItrFilingOut:
    rules = service.get_rules_or_404(assessment_year)
    filing = service.get_or_create_filing(db, current_user, rules)
    return service.to_out(service.save_draft(db, filing, payload))


@router.get("/filings/{assessment_year}/summary", response_model=ItrSummary)
def get_summary(
    assessment_year: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    as_of: date = Depends(filing_date),
) -> ItrSummary:
    rules = service.get_rules_or_404(assessment_year)
    filing = service.get_or_create_filing(db, current_user, rules)
    return service.build_summary(
        ItrDraftData.model_validate(filing.data), rules, as_of, service.document_facts(db, current_user)
    )


@router.post("/filings/{assessment_year}/export", response_model=ItrExport)
def export_filing(
    assessment_year: str,
    current_user: User = Depends(rate_limited_user("export")),
    db: Session = Depends(get_db),
    as_of: date = Depends(filing_date),
) -> ItrExport:
    rules = service.get_rules_or_404(assessment_year)
    filing = service.get_or_create_filing(db, current_user, rules)
    return service.export_filing(db, filing, rules, as_of, service.document_facts(db, current_user))


@router.post("/filings/{assessment_year}/reread-documents", response_model=ItrFilingOut)
def reread_documents(
    assessment_year: str,
    current_user: User = Depends(rate_limited_user("reread")),
    db: Session = Depends(get_db),
) -> ItrFilingOut:
    """Re-reads all uploaded documents and fills the draft again (keeps values the user edited)."""
    rules = service.get_rules_or_404(assessment_year)
    return service.to_out(documents_service.reread_documents(db, current_user, rules))


@router.get("/filings/{assessment_year}/export/pdf")
def export_pdf(
    assessment_year: str,
    current_user: User = Depends(rate_limited_user("export")),
    db: Session = Depends(get_db),
    as_of: date = Depends(filing_date),
) -> Response:
    """Readable PDF of the return. Available even when incomplete (marked DRAFT)."""
    rules = service.get_rules_or_404(assessment_year)
    filing = service.get_or_create_filing(db, current_user, rules)
    draft = ItrDraftData.model_validate(filing.data)
    summary = service.build_summary(draft, rules, as_of, service.document_facts(db, current_user))
    pan = (draft.personal.pan or "DRAFT").strip().upper()
    form = (summary.recommended_form.form if summary.recommended_form else "ITR-1").replace("-", "")
    return Response(
        pdf.build_itr_pdf(draft, summary, rules),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{form}_AY{rules.assessment_year}_{pan}.pdf"'},
    )
