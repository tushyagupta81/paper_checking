from sqlalchemy import TIMESTAMP, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from database.database import Base


class UserLog(Base):
    __tablename__ = "user_log"

    id = Column(Integer, autoincrement=True, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    mac_addr = Column(String(54), nullable=False)
    ip_addr = Column(String(45), nullable=False)
    action = Column(String(255), nullable=False)
    time = Column(TIMESTAMP, nullable=False)

    user = relationship("Users", backref="user_logs")


class WorkbookLog(Base):
    __tablename__ = "workbook_log"

    id = Column(Integer, autoincrement=True, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    mac_addr = Column(String(54), nullable=False)
    ip_addr = Column(String(45), nullable=False)
    action = Column(String(255), nullable=False)
    time = Column(TIMESTAMP, nullable=False)
    workbook_id = Column(
        String(255), ForeignKey("student_workbook.workbook_id"), nullable=False
    )
    question_no = Column(Integer, nullable=True)
    old_val = Column(Integer, nullable=True)
    new_val = Column(Integer, nullable=True)

    user = relationship("Users", backref="workbook_logs")
