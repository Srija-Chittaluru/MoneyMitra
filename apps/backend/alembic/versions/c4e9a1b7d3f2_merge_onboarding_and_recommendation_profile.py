"""merge tax onboarding and recommendation profile heads

Revision ID: c4e9a1b7d3f2
Revises: b81e5c3f7a24, b8d52e3f1c41
Create Date: 2026-10-06 14:00:00.000000

Both revisions branched from a7c41d2e9b30 and add different columns to
`users`, so there is nothing to reconcile; this only joins the two heads.
"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'c4e9a1b7d3f2'
down_revision: Union[str, Sequence[str], None] = ('b81e5c3f7a24', 'b8d52e3f1c41')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
