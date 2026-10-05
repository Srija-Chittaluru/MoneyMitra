"""add tax comparison snapshots

Revision ID: a7c41d2e9b30
Revises: f12976c639ec
Create Date: 2026-10-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a7c41d2e9b30'
down_revision: Union[str, None] = 'f12976c639ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('tax_comparison_snapshots',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('tax_year', sa.String(length=7), nullable=False),
    sa.Column('gross_total_income', sa.BigInteger(), nullable=False),
    sa.Column('section_80c', sa.BigInteger(), nullable=False),
    sa.Column('section_80d', sa.BigInteger(), nullable=False),
    sa.Column('hra_exemption', sa.BigInteger(), nullable=False),
    sa.Column('home_loan_interest', sa.BigInteger(), nullable=False),
    sa.Column('nps_contribution', sa.BigInteger(), nullable=False),
    sa.Column('other_deductions', sa.BigInteger(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )


def downgrade() -> None:
    op.drop_table('tax_comparison_snapshots')
