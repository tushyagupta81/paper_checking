"""added checked field to images

Revision ID: 5e6f8abab2de
Revises: 17a0d9d0f480
Create Date: 2025-11-06 03:39:33.031659

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5e6f8abab2de"
down_revision: Union[str, Sequence[str], None] = "17a0d9d0f480"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column(
        "images",
        sa.Column("checked", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.execute(
        "ALTER TABLE images DROP PRIMARY KEY, ADD PRIMARY KEY (workbook_id, question_no, page_no, checked)"
    )



def downgrade():
    op.execute(
        "ALTER TABLE images DROP PRIMARY KEY, ADD PRIMARY KEY (workbook_id, question_no, page_no)"
    )
    op.drop_column("images", "checked")
