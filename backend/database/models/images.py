from pydantic import BaseModel
from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from database.database import Base


class Images(Base):
    __tablename__ = "images"

    workbook_id = Column(
        String(255), ForeignKey("student_workbook.workbook_id"), primary_key=True
    )
    question_no = Column(
        Integer, primary_key=True
    )
    page_no = Column(Integer, primary_key=True)
    object_key = Column(String(255), nullable=False)

    workbook = relationship("StudentWorkbook", backref="images_from_student")


class GetImages(BaseModel):
    workbook_id: str
    question_no: int
    mac_addr: str
