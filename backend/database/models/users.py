import re
from enum import Enum

from pydantic import BaseModel, field_validator
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import backref, relationship

from database.database import Base
from utils.mac_addr_type import MacAddress


class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    password = Column(String(255), nullable=False)
    type = Column(String(255), nullable=False)

    examiners = relationship("Examiners", backref=backref("user", lazy="joined"))
    students = relationship(
        "StudentWorkbook",
        primaryjoin="Users.id==StudentWorkbook.student_id",
        backref=backref("user", lazy="joined"),
    )


class UserType(str, Enum):
    admin = "admin"
    examiner = "examiner"
    student = "student"


class UserCreate(BaseModel):
    password: str
    mac_addr: MacAddress
    type: UserType

    @field_validator("password")
    def strong_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain a number")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain a special character")
        return v


class UserLogin(BaseModel):
    id: int
    mac_addr: MacAddress
    password: str

class GetQuestions(BaseModel):
    mac_addr: MacAddress

