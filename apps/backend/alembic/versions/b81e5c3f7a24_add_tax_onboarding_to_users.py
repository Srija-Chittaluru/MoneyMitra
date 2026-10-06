"""add tax onboarding fields to users

Revision ID: b81e5c3f7a24
Revises: a7c41d2e9b30
Create Date: 2026-10-06 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b81e5c3f7a24'
down_revision: Union[str, None] = 'a7c41d2e9b30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('pan_encrypted', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('tax_onboarding_status', sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'tax_onboarding_status')
    op.drop_column('users', 'pan_encrypted')
