import uuid
from dataclasses import replace
from datetime import UTC, date, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.documents.models import Document
from app.modules.extraction.autofill import SOURCE_LABELS, apply_extraction, prune_sources
from app.modules.extraction.parsers import Extraction
from app.modules.itr import computation, export, export_itr23, form_selector, validation
from app.modules.itr.form_selector import DocumentFacts
from app.modules.itr.models import ItrFiling
from app.modules.itr.rules import ItrYearRules, get_itr_rules, get_supported_assessment_years
from app.modules.itr.schemas import Issue, ItrDraftData, ItrExport, ItrFilingOut, ItrSummary
from app.modules.users.models import User


def get_rules_or_404(assessment_year: str) -> ItrYearRules:
    rules = get_itr_rules(assessment_year)
    if rules is None:
        supported = ", ".join(get_supported_assessment_years())
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"Unsupported assessment year '{assessment_year}'. Supported years: {supported}",
        )
    return rules


def get_or_create_filing(
    db: Session, user: User, rules: ItrYearRules, skip_document_id: uuid.UUID | None = None
) -> ItrFiling:
    filing = db.scalar(
        select(ItrFiling).where(ItrFiling.user_id == user.id, ItrFiling.assessment_year == rules.assessment_year)
    )
    if filing is not None:
        return filing

    draft = ItrDraftData()
    draft.personal.email = user.email
    draft.personal.date_of_birth = user.date_of_birth
    filing = ItrFiling(
        user_id=user.id,
        assessment_year=rules.assessment_year,
        status="draft",
        data=draft.model_dump(mode="json"),
        autofill={"applied": [], "sources": {}},
    )
    db.add(filing)
    # Documents uploaded before the draft existed are applied now, oldest first.
    documents = db.scalars(
        select(Document)
        .where(Document.user_id == user.id, Document.extraction_status == "extracted")
        .order_by(Document.uploaded_at)
    )
    for document in documents:
        if document.id != skip_document_id:
            _apply_document(filing, document, rules)
    db.commit()
    db.refresh(filing)
    return filing


def _apply_document(filing: ItrFiling, document: Document, rules: ItrYearRules) -> list[str] | None:
    """Fills empty draft fields from one document. Returns the filled paths,
    or None when the document is for a different assessment year."""
    autofill = {"applied": [], "sources": {}, **(filing.autofill or {})}
    if str(document.id) in autofill["applied"] or not document.extracted:
        return []
    extraction = Extraction.from_json(document.extracted)
    if extraction.assessment_year not in (None, rules.assessment_year):
        return None

    sources = dict(autofill["sources"])
    draft, filled = apply_extraction(
        ItrDraftData.model_validate(filing.data), extraction, SOURCE_LABELS.get(document.category, "document"), sources
    )
    filing.data = draft.model_dump(mode="json")
    filing.autofill = {"applied": [*autofill["applied"], str(document.id)], "sources": sources}
    if filled:
        filing.status = "draft"
    return filled


def autofill_from_document(db: Session, user: User, document: Document) -> str:
    """Applies a freshly extracted document to the user's ITR draft and
    returns a one-line summary for the Documents page."""
    extraction = Extraction.from_json(document.extracted or {})
    if extraction.assessment_year is None:
        rules = get_itr_rules(get_supported_assessment_years()[-1])
    else:
        rules = get_itr_rules(extraction.assessment_year)
        if rules is None:
            return (
                f"This document is for AY {extraction.assessment_year}, which MoneyMitra doesn't file yet, "
                "so nothing was filled."
            )

    filing = get_or_create_filing(db, user, rules, skip_document_id=document.id)
    filled = _apply_document(filing, document, rules) or []
    db.commit()

    notes = " ".join(extraction.notes)
    if not filled:
        return f"Details found, but the matching ITR fields were already filled. {notes}".strip()
    plural = "s" if len(filled) != 1 else ""
    return f"Filled {len(filled)} field{plural} in ITR Filing (AY {rules.assessment_year}). {notes}".strip()


def to_out(filing: ItrFiling) -> ItrFilingOut:
    sources = (filing.autofill or {}).get("sources", {})
    return ItrFilingOut(
        field_sources={path: meta["label"] for path, meta in sources.items()},
        assessment_year=filing.assessment_year,
        status=filing.status,
        data=ItrDraftData.model_validate(filing.data),
        updated_at=filing.updated_at,
        last_exported_at=filing.last_exported_at,
    )


def save_draft(db: Session, filing: ItrFiling, draft: ItrDraftData) -> ItrFiling:
    filing.data = draft.model_dump(mode="json")
    filing.status = "draft"  # any edit invalidates a previously exported file
    autofill = filing.autofill or {}
    filing.autofill = {**autofill, "sources": prune_sources(draft, autofill.get("sources", {}))}
    db.commit()
    db.refresh(filing)
    return filing


def document_facts(db: Session, user: User) -> DocumentFacts:
    rows = db.execute(select(Document.category, Document.extracted).where(Document.user_id == user.id)).all()
    return DocumentFacts.from_documents([(category, extracted) for category, extracted in rows])


def rules_for_form(rules: ItrYearRules, form: str) -> ItrYearRules:
    """ITR-3 (business, no tax audit) has a later due date than ITR-1/ITR-2."""
    if form == "ITR-3" and rules.due_date_business:
        return replace(rules, due_date=rules.due_date_business)
    return rules


def build_summary(
    draft: ItrDraftData, rules: ItrYearRules, filing_date: date, facts: DocumentFacts | None = None
) -> ItrSummary:
    facts = facts or DocumentFacts()
    # The form decides the due date, which decides belated status and the
    # regime; decide it on a first pass, then compute with that form's rules.
    first = computation.compute(draft, "new", rules, filing_date)
    recommendation = form_selector.recommend_form(draft, first.summary, facts, rules)
    rules = rules_for_form(rules, recommendation.form)

    allowed_old = validation.old_regime_allowed(filing_date, rules)
    regime = draft.regime if (draft.regime == "new" or allowed_old) else "new"
    selected = computation.compute(draft, regime, rules, filing_date)

    alternative = None
    if allowed_old:
        other = "old" if regime == "new" else "new"
        alternative = computation.compute(draft, other, rules, filing_date).summary

    eligibility = validation.eligibility_issues(draft, selected, rules, form_checked=True)
    if not recommendation.supported:
        why = " ".join(r.reason for r in recommendation.reasons)
        blockers = " ".join(recommendation.blockers)
        eligibility.insert(0, Issue(
            field=None,
            message=f"You need to file {recommendation.form}. {why} MoneyMitra can't prepare it yet: {blockers} "
            f"File {recommendation.form} on the Income Tax portal.",
        ))
    missing = validation.missing_fields(draft, selected, rules, form=recommendation.form)
    if recommendation.form != "ITR-1" and not draft.capital_gains and (
        facts.capital_gains or draft.eligibility.has_capital_gains
    ):
        missing.insert(0, Issue(
            field="capital_gains",
            message="Add the shares and mutual funds you sold (from your AIS or broker statement).",
        ))
    warnings = (
        validation.warnings(draft, selected, rules)
        + form_selector.tds_cross_check(draft, facts)
        + form_selector.identity_checks(draft, facts)
    )
    return ItrSummary(
        assessment_year=rules.assessment_year,
        filing_date=filing_date,
        filing_section="139(1)" if filing_date <= rules.due_date else "139(4)",
        is_belated=filing_date > rules.due_date,
        old_regime_allowed=allowed_old,
        selected=selected.summary,
        alternative=alternative,
        eligibility_issues=eligibility,
        missing_fields=missing,
        warnings=warnings,
        can_export=not eligibility and not missing,
        recommended_form=recommendation,
    )


def export_filing(
    db: Session, filing: ItrFiling, rules: ItrYearRules, filing_date: date, facts: DocumentFacts | None = None
) -> ItrExport:
    draft = ItrDraftData.model_validate(filing.data)
    summary = build_summary(draft, rules, filing_date, facts)
    blocking = summary.eligibility_issues + summary.missing_fields
    if blocking:
        details = "; ".join(issue.message for issue in blocking[:5])
        more = f" (and {len(blocking) - 5} more)" if len(blocking) > 5 else ""
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Return is not ready: {details}{more}")

    form = summary.recommended_form.form if summary.recommended_form else "ITR-1"
    form_rules = rules_for_form(rules, form)
    comp = computation.compute(draft, summary.selected.regime, form_rules, filing_date)
    if form == "ITR-1":
        itr = export.build_itr_json(draft, comp, form_rules)
        errors = export.schema_errors(itr, form_rules)
    else:
        itr = export_itr23.build_itr23_json(draft, comp, form_rules, form)
        errors = export_itr23.itr23_schema_errors(itr, form)
    if errors:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"The generated return does not match the official {form} schema: " + "; ".join(errors[:5]),
        )

    filing.status = "exported"
    filing.last_exported_at = datetime.now(UTC)
    db.commit()
    file_name = f"{form.replace('-', '')}_AY{rules.assessment_year}_{draft.personal.pan.strip().upper()}.json"
    return ItrExport(file_name=file_name, form=form, itr=itr)
