"""add recommendation profile to users

Revision ID: b8d52e3f1c41
Revises: a7c41d2e9b30
Create Date: 2026-10-06 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b8d52e3f1c41'
down_revision: Union[str, None] = 'a7c41d2e9b30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('employee_category', sa.String(length=16), nullable=True))
    op.add_column('users', sa.Column('expected_annual_income', sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'expected_annual_income')
    op.drop_column('users', 'employee_category')
