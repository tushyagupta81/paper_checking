"""added comment field to workbook_marking

Revision ID: a1b2c3d4e5f6
Revises: 5e6f8abab2de
Create Date: 2026-06-20 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "5e6f8abab2de"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column(
        "workbook_marking",
        sa.Column("comment", sa.String(length=2000), nullable=True),
    )


def downgrade():
    op.drop_column("workbook_marking", "comment")
