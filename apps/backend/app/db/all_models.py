"""Import every ORM model so they register on Base.metadata for Alembic autogenerate."""

from app.db.base import Base
from app.modules.auth.models import RefreshToken  # noqa: F401
from app.modules.documents.models import Document  # noqa: F401
from app.modules.expert_filing.models import ExpertFilingRequest  # noqa: F401
from app.modules.itr.models import ItrFiling  # noqa: F401
from app.modules.tax.models import TaxComparisonSnapshot  # noqa: F401
from app.modules.users.models import User  # noqa: F401

__all__ = ["Base"]
