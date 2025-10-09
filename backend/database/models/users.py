from pydantic import BaseModel
from sqlalchemy import Column, Integer, String

from database.database import Base


class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    password = Column(String(255), nullable=False)
    type = Column(String(255), nullable=False)


class UserCreate(BaseModel):
    password: str
    type: str

class UserLogin(BaseModel):
    id: int
    password: str
