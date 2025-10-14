import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import Users

load_dotenv()

SECRET_KEY = os.environ.get("SECRET_KEY")
if SECRET_KEY is None:
    print("Missing SECRET_KEY in .env")
    exit(1)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login", scheme_name="BearerAuth")


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: int | None = None


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)  # pyright: ignore[reportArgumentType]
    return encoded_jwt


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)], db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(str(token), SECRET_KEY, algorithms=[ALGORITHM])  # pyright: ignore[reportArgumentType]
        user_id = int(payload.get("sub"))
        if user_id is None:
            raise credentials_exception
        token_data = TokenData(user_id=user_id)
        print(token_data)
    except Exception as e:
        print(e)
        raise credentials_exception
    user = db.query(Users).filter(Users.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user
