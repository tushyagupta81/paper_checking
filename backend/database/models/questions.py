from pydantic import BaseModel
from sqlalchemy import (Boolean, Column, DateTime, ForeignKey,
                        ForeignKeyConstraint, Integer, String)
from sqlalchemy.sql import func

from database.database import Base
from utils.mac_addr_type import MacAddress


class QuestionBank(Base):
    __tablename__ = "question_bank"

    paper_id = Column(String(255), primary_key=True)
    question_no = Column(Integer, primary_key=True)
    max_marks = Column(Integer, nullable=False)
    pages = Column(Integer, nullable=False)
    question_key = Column(String(255), nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(), server_default=func.now(), nullable=False)


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


class AssignExaminer(BaseModel):
    id: int
    mac_addr: MacAddress
    paper_id: str
    question_no: int


class UnassignedExaminers(BaseModel):
    mac_addr: MacAddress