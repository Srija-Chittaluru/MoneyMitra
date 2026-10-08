from datetime import date

from sqlalchemy.orm import Session

from app.modules.recommendations import engine
from app.modules.recommendations.facts import build_facts
from app.modules.recommendations.levels import LEVEL_LABELS
from app.modules.recommendations.profile import profile_of
from app.modules.recommendations.schemas import AnalysedDocumentOut, DocumentsOut, RecommendationsOut, SkippedDocumentOut
from app.modules.recommendations.stages import STAGE_LABELS
from app.modules.users.models import User

DISCLAIMER = (
    "These are general guidelines and worked examples, not personal investment advice. The rates used are "
    "illustrative assumptions, investments in the market can lose value, and past returns don't guarantee future "
    "ones. Consider speaking to a SEBI-registered adviser before you invest."
)


def get_recommendations(db: Session, user: User, today: date | None = None) -> RecommendationsOut:
    facts = build_facts(db, user, today or date.today())
    return RecommendationsOut(
        level=int(facts.level),
        level_label=LEVEL_LABELS[facts.level],
        profile=profile_of(user),
        age=facts.age,
        stage=facts.stage,
        stage_label=STAGE_LABELS[facts.stage] if facts.stage else None,
        context_source=facts.declared.source if facts.declared else None,
        next_step=engine.next_step(facts),
        documents=DocumentsOut(
            analysed=[AnalysedDocumentOut(**vars(doc)) for doc in facts.documents.analysed],
            skipped=[SkippedDocumentOut(**vars(doc)) for doc in facts.documents.skipped],
        ),
        disclaimer=DISCLAIMER,
        recommendations=engine.run(facts),
    )
