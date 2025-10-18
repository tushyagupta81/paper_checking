from pydantic import BaseModel
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import backref, relationship

from database.database import Base


class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    password = Column(String(255), nullable=False)
    type = Column(String(255), nullable=False)

    examiners = relationship("Examiners", backref=backref("user", lazy="joined"))
    students = relationship("StudentWorkbook", primaryjoin="Users.id==StudentWorkbook.student_id", backref=backref("user", lazy="joined"))


class UserCreate(BaseModel):
    password: str
    mac_addr: str
    type: str


class UserLogin(BaseModel):
    id: int
    mac_addr: str
    password: str
