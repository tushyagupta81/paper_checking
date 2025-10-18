from pydantic import BaseModel
from sqlalchemy import TIMESTAMP, Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import backref, relationship

from database.database import Base


class StudentWorkbook(Base):
    __tablename__ = "student_workbook"

    student_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    workbook_id = Column(String(255), unique=True, nullable=False)
    paper_id = Column(String(255), ForeignKey("question_bank.paper_id"), nullable=False)


class AssignWorkbook(BaseModel):
    student_id: int
    workbook_id: str
    paper_id: str
    mac_addr: str


class WorkbookStatus(Base):
    __tablename__ = "workbook_status"

    workbook_id = Column(
        String(255), ForeignKey("student_workbook.workbook_id"), primary_key=True
    )
    question_no = Column(Integer, primary_key=True)
    checked = Column(Boolean, nullable=False, default=False)

    student = relationship("StudentWorkbook", backref="statuses")


class WorkbookMarking(Base):
    __tablename__ = "workbook_marking"

    workbook_id = Column(
        String(255), ForeignKey("student_workbook.workbook_id"), primary_key=True
    )
    question_no = Column(Integer, primary_key=True)
    open_time = Column(TIMESTAMP, nullable=False)
    marks = Column(Integer, nullable=True)
    submit_time = Column(TIMESTAMP, nullable=True)

    student = relationship("StudentWorkbook", backref="workbook_marks_for_student")
