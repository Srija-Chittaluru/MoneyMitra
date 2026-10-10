"""merge expert-filing and recommendation-status heads

Revision ID: 0bf831140602
Revises: d3f8a21b5c67, dfd2882d9e70
Create Date: 2026-10-10 13:11:51.966403

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0bf831140602'
down_revision: Union[str, None] = ('d3f8a21b5c67', 'dfd2882d9e70')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
