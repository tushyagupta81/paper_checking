"""added number of pages per question to question bank

Revision ID: afb77e0eb63c
Revises: 3e4ae9fb2a77
Create Date: 2025-11-04 21:09:47.996722

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'afb77e0eb63c'
down_revision: Union[str, Sequence[str], None] = '3e4ae9fb2a77'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
