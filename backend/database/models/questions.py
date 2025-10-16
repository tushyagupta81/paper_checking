from sqlalchemy import (Boolean, Column, ForeignKey, ForeignKeyConstraint,
                        Integer, String)
from sqlalchemy.orm import relationship

from database.database import Base


class QuestionBank(Base):
    __tablename__ = "question_bank"

    paper_id = Column(String(255), primary_key=True)
    question_no = Column(Integer, primary_key=True)
    max_marks = Column(Integer, nullable=False)
    question_key = Column(String(255), nullable=False)
    active = Column(Boolean, default=True)


class Examiners(Base):
    __tablename__ = "examiners"

    examiner_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    paper_id = Column(String(255), primary_key=True)
    question_no = Column(Integer, primary_key=True)

    __table_args__ = (
        ForeignKeyConstraint(
            ["paper_id", "question_no"],
            ["question_bank.paper_id", "question_bank.question_no"],
        ),
    )

    question_bank = relationship("QuestionBank", backref="examiners")
    user = relationship("Users", backref="examiners")
