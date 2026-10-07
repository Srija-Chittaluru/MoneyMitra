"""Level 3: what the user's uploaded documents say.

The documents' extracted figures are applied to a blank ITR draft (the same
way the ITR autofill does), so the result can be run through the existing
ITR computation. That draft is never saved; it only describes what the
documents contain, independently of anything the user has typed since.

Every document gets a verdict, either analysed or skipped with a reason, so
the user can see why they are or aren't on Level 3.
"""

from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.documents.models import Document
from app.modules.extraction.autofill import SOURCE_LABELS, apply_extraction
from app.modules.extraction.parsers import EXTRACTABLE_CATEGORIES, Extraction
from app.modules.itr import service as itr_service
from app.modules.itr.rules import get_itr_rules, get_supported_assessment_years
from app.modules.itr.schemas import ItrDraftData, ItrSummary
from app.modules.recommendations.context import RegimeOutcome, regime_outcome_from_summary
from app.modules.users.models import User

@dataclass(frozen=True)
class AnalysedDocument:
    category: str
    label: str
    file_name: str


@dataclass(frozen=True)
class SkippedDocument:
    category: str
    file_name: str
    reason: str


@dataclass(frozen=True)
class DocumentAnalysis:
    analysed: list[AnalysedDocument] = field(default_factory=list)
    skipped: list[SkippedDocument] = field(default_factory=list)
    # What the documents alone say, as an ITR draft (None when nothing was analysed).
    draft: ItrDraftData | None = None
    summary: ItrSummary | None = None
    regime: RegimeOutcome | None = None

    @property
    def usable(self) -> bool:
        return bool(self.analysed)

    @property
    def categories(self) -> frozenset[str]:
        return frozenset(doc.category for doc in self.analysed)

    @property
    def source_text(self) -> str:
        """'Form 16 and AIS', for the 'From your ...' basis line."""
        labels = []
        for doc in self.analysed:
            if doc.label not in labels:
                labels.append(doc.label)
        return " and ".join(labels) if len(labels) < 3 else ", ".join(labels[:-1]) + " and " + labels[-1]


def _skip_reason(doc: Document, assessment_year: str) -> str | None:
    # Of the extractable categories only a PAN card carries no figures, just identity.
    if doc.category == "pan":
        return "Used to fill in your identity details; there's nothing in it to advise on."
    if doc.category not in EXTRACTABLE_CATEGORIES:
        return "This type of document isn't analysed yet."
    if doc.extraction_status == "unsupported":
        return doc.extraction_message or "This file couldn't be read."
    if doc.extraction_status != "extracted" or not doc.extracted:
        return "No usable figures were found in this document."

    extraction = Extraction.from_json(doc.extracted)
    if extraction.assessment_year not in (None, assessment_year):
        return f"It's for assessment year {extraction.assessment_year}, which isn't supported yet."
    if extraction.is_empty:
        return "No usable figures were found in this document."
    return None


def analyse(documents: Iterable[Document], date_of_birth: date | None, today: date) -> DocumentAnalysis:
    """`documents` should be oldest-first: when two documents give the same
    field, the earlier upload wins, as in the ITR autofill."""
    assessment_year = get_supported_assessment_years()[-1]
    rules = get_itr_rules(assessment_year)
    assert rules is not None

    analysed: list[AnalysedDocument] = []
    skipped: list[SkippedDocument] = []
    draft = ItrDraftData()
    draft.personal.date_of_birth = date_of_birth

    for doc in documents:
        reason = _skip_reason(doc, assessment_year)
        if reason is not None:
            skipped.append(SkippedDocument(doc.category, doc.file_name, reason))
            continue

        label = SOURCE_LABELS.get(doc.category, "document")
        draft, _ = apply_extraction(draft, Extraction.from_json(doc.extracted), label, {})
        analysed.append(AnalysedDocument(doc.category, label, doc.file_name))

    if not analysed:
        return DocumentAnalysis(skipped=skipped)

    summary = itr_service.build_summary(draft, rules, today)
    return DocumentAnalysis(
        analysed=analysed,
        skipped=skipped,
        draft=draft,
        summary=summary,
        regime=regime_outcome_from_summary(summary),
    )


def load_document_analysis(db: Session, user: User, today: date) -> DocumentAnalysis:
    documents = db.scalars(select(Document).where(Document.user_id == user.id).order_by(Document.uploaded_at.asc()))
    return analyse(documents, user.date_of_birth, today)
