"""add goals and goal contributions

Revision ID: 4c763833cf15
Revises: 0bf831140602
Create Date: 2026-10-09 23:47:14.594811

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '4c763833cf15'
down_revision: Union[str, None] = '0bf831140602'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('goals',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('title', sa.String(length=100), nullable=False),
    sa.Column('goal_type', sa.String(length=16), nullable=False),
    # Nullable: the journey wizard can create a goal before its cost or date is
    # settled ("Not set yet" / "Not sure yet").
    sa.Column('target_date', sa.Date(), nullable=True),
    sa.Column('cost_today', sa.BigInteger(), nullable=True),
    sa.Column('existing_savings', sa.BigInteger(), server_default='0', nullable=False),
    sa.Column('loan_pct', sa.Integer(), server_default='0', nullable=False),
    sa.Column('priority', sa.Integer(), server_default='0', nullable=False),
    sa.Column('status', sa.String(length=16), server_default='active', nullable=False),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("goal_type IN ('efund', 'car', 'house', 'travel', 'study', 'marriage', 'family', 'business', 'retire', 'wealth', 'debt', 'custom')", name='ck_goals_goal_type'),
    sa.CheckConstraint("status IN ('active', 'completed', 'archived')", name='ck_goals_status'),
    sa.CheckConstraint('cost_today BETWEEN 100 AND 1000000000', name='ck_goals_cost_today'),
    sa.CheckConstraint('existing_savings BETWEEN 0 AND 1000000000', name='ck_goals_existing_savings'),
    sa.CheckConstraint('loan_pct BETWEEN 0 AND 100', name='ck_goals_loan_pct'),
    sa.CheckConstraint("(status = 'completed') = (completed_at IS NOT NULL)", name='ck_goals_completed_at'),
    sa.CheckConstraint('length(trim(title)) > 0', name='ck_goals_title_not_blank'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('id', 'user_id', name='uq_goals_id_user')
    )
    op.create_index(op.f('ix_goals_user_id'), 'goals', ['user_id'], unique=False)
    op.create_table('goal_contributions',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('goal_id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('amount', sa.BigInteger(), nullable=False),
    sa.Column('contributed_on', sa.Date(), nullable=False),
    sa.Column('note', sa.String(length=200), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('amount BETWEEN 1 AND 1000000000', name='ck_goal_contributions_amount'),
    # No ON DELETE: a goal with contributions can't be deleted, but deleting the user
    # (which cascades to both tables) still succeeds, as NO ACTION is checked at statement end.
    sa.ForeignKeyConstraint(['goal_id', 'user_id'], ['goals.id', 'goals.user_id'], name='fk_goal_contributions_goal_user'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_goal_contributions_goal_id_contributed_on', 'goal_contributions', ['goal_id', 'contributed_on'], unique=False)
    op.create_index(op.f('ix_goal_contributions_user_id'), 'goal_contributions', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_goal_contributions_user_id'), table_name='goal_contributions')
    op.drop_index('ix_goal_contributions_goal_id_contributed_on', table_name='goal_contributions')
    op.drop_table('goal_contributions')
    op.drop_index(op.f('ix_goals_user_id'), table_name='goals')
    op.drop_table('goals')
