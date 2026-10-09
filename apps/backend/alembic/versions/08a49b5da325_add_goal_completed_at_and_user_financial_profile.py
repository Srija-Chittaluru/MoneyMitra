"""add goal completed_at and user financial profile

Revision ID: 08a49b5da325
Revises: 4c763833cf15
Create Date: 2026-10-10 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '08a49b5da325'
down_revision: Union[str, None] = '4c763833cf15'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('goals', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    # Goals already completed get their last update as a completion time, so the check below holds.
    op.execute("UPDATE goals SET completed_at = updated_at WHERE status = 'completed'")
    op.create_check_constraint(
        'ck_goals_completed_at', 'goals', "(status = 'completed') = (completed_at IS NOT NULL)"
    )

    op.add_column('users', sa.Column('monthly_take_home', sa.BigInteger(), nullable=True))
    op.add_column('users', sa.Column('monthly_expenses', sa.BigInteger(), nullable=True))
    op.create_check_constraint(
        'ck_users_monthly_take_home', 'users', 'monthly_take_home BETWEEN 1 AND 100000000'
    )
    op.create_check_constraint(
        'ck_users_monthly_expenses', 'users', 'monthly_expenses BETWEEN 0 AND 100000000'
    )


def downgrade() -> None:
    op.drop_constraint('ck_users_monthly_expenses', 'users', type_='check')
    op.drop_constraint('ck_users_monthly_take_home', 'users', type_='check')
    op.drop_column('users', 'monthly_expenses')
    op.drop_column('users', 'monthly_take_home')
    op.drop_constraint('ck_goals_completed_at', 'goals', type_='check')
    op.drop_column('goals', 'completed_at')
