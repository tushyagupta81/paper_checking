from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session

from alembic import command
from alembic.config import Config
from auth.utils import hash_password, verify_password
from database.database import get_db
from database.models import UserCreate, UserLog, UserLogin, Users


def run_migrations():
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs at startup
    run_migrations()
    yield
    # Runs at shutdown (if needed)


# app = FastAPI(lifespan=lifespan)
app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.post("/users/signup")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    hashed_pw = hash_password(user.password)
    new_user = Users(password=hashed_pw, type=user.type)
    db.add(new_user)
    db.flush()
    user_log = UserLog(
        user_id=new_user.id,
        mac_addr=user.mac_addr,
        action="signup",
        time=datetime.now(),
    )
    db.add(user_log)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created", "id": new_user.id}


@app.post("/users/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(Users).filter(Users.id == user.id).first()
    try:
        if not db_user or not verify_password(user.password, str(db_user.password)):
            raise HTTPException(status_code=400, detail="Invalid credentials")
        user_log = UserLog(
            user_id=db_user.id,
            mac_addr=user.mac_addr,
            action="login",
            time=datetime.now(),
        )
        db.add(user_log)
        db.commit()
        return {"message": "Login successful"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid credentials: {e}")
