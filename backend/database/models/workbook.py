from sqlalchemy import (TIMESTAMP, Boolean, Column, ForeignKey,
                        ForeignKeyConstraint, Integer)
from sqlalchemy.orm import backref, relationship

from database.database import Base


class StudentWorkbook(Base):
    __tablename__ = "student_workbook"

    student_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    workbook_id = Column(Integer, unique=True, nullable=False)

    student = relationship("Users", backref=backref("workbook", uselist=False))


class WorkbookStatus(Base):
    __tablename__ = "workbook_status"

    workbook_id = Column(
        Integer, ForeignKey("student_workbook.workbook_id"), primary_key=True
    )
    paper_id = Column(Integer, primary_key=True)
    question_no = Column(Integer, primary_key=True)
    checked = Column(Boolean, nullable=False, default=False)

    __table_args__ = ForeignKeyConstraint(
        ["paper_id", "question_no"],
        ["question_bank.paper_id", "question_bank.question_no"],
    )

    student = relationship("StudentWorkbook", backref="statuses")
    paper = relationship("QuestionBank", backref="workbook_statuses")


class WorkbookMarking(Base):
    __tablename__ = "workbook_marking"

    workbook_id = Column(
        Integer, ForeignKey("student_workbook.workbook_id"), primary_key=True
    )
    paper_id = Column(Integer, primary_key=True)
    question_no = Column(Integer, primary_key=True)
    open_time = Column(TIMESTAMP, nullable=False)
    marks = Column(Integer, nullable=True)
    submit_time = Column(TIMESTAMP, nullable=True)

    __table_args__ = ForeignKeyConstraint(
        ["paper_id", "question_no"],
        ["question_bank.paper_id", "question_bank.question_no"],
    )

    student = relationship("StudentWorkbook", backref="workbook_marks_for_student")
    paper = relationship("QuestionBank", backref="workbook_marks_for_paper")
