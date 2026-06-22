"""added created_at to question_bank

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-22 00:00:00.000000

Adds a created_at timestamp to question_bank so the admin's "Assign
Examiner" page (and any other admin list) can sort newly-added
paper+question rows to the top, instead of an arbitrary/insertion order
that doesn't reflect what was added most recently.

Existing rows have no real historical creation time on record, so they
are backfilled with the current timestamp at migration time — this means
rows that already existed before this migration will all sort together,
behind anything created afterward, which is the best honest approximation
available without a pre-existing timestamp to draw from.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column(
        "question_bank",
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )


def downgrade():
    op.drop_column("question_bank", "created_at")
