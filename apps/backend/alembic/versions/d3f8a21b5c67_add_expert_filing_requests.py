"""add expert filing requests

Revision ID: d3f8a21b5c67
Revises: b7fd5cb1ab35
Create Date: 2026-10-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd3f8a21b5c67'
down_revision: Union[str, None] = 'b7fd5cb1ab35'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('expert_filing_requests',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('assessment_year', sa.String(length=7), nullable=False),
    sa.Column('plan', sa.String(length=16), nullable=False),
    sa.Column('price', sa.Integer(), nullable=False),
    sa.Column('calls_included', sa.Integer(), nullable=False),
    sa.Column('contact_phone', sa.String(length=20), nullable=False),
    sa.Column('preferred_time', sa.String(length=255), nullable=True),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_expert_filing_requests_user_id'), 'expert_filing_requests', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_expert_filing_requests_user_id'), table_name='expert_filing_requests')
    op.drop_table('expert_filing_requests')
