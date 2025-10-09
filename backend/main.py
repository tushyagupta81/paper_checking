from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session

from auth.utils import hash_password, verify_password
from database.database import get_db
from database.models import UserCreate, UserLogin, Users

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.post("/users/")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    hashed_pw = hash_password(user.password)
    new_user = Users(password=hashed_pw, type=user.type)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created", "id": new_user.id}


@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(Users).filter(Users.id == user.id).first()
    try:
        if not db_user or not verify_password(user.password, str(db_user.password)):
            raise HTTPException(status_code=400, detail="Invalid credentials")
        return {"message": "Login successful"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid credentials: {e}")
