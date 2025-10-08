from sqlalchemy import (Column, ForeignKey, ForeignKeyConstraint, Integer,
                        String)
from sqlalchemy.orm import relationship

from database.database import Base


class Images(Base):
    __tablename__ = "images"

    workbook_id = Column(
        Integer, ForeignKey("student_workbook.workbook_id"), primary_key=True
    )
    paper_id = Column(Integer, primary_key=True)
    question_no = Column(Integer, primary_key=True)
    object_key = Column(String(255), nullable=False)

    __table_args__ = ForeignKeyConstraint(
        ["paper_id", "question_no"],
        ["question_bank.paper_id", "question_bank.question_no"],
    )

    workbook = relationship("StudentWorkbook", backref="images")
    paper = relationship("QuestionBank", backref="images")
