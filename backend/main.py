from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import Depends, Security, FastAPI, HTTPException, Request, status
from fastapi.openapi.utils import get_openapi
from sqlalchemy.orm import Session

from alembic import command
from alembic.config import Config
from auth.jwt_utils import (ACCESS_TOKEN_EXPIRE_MINUTES, Token,
                            create_access_token, get_current_user)
from auth.utils import hash_password, verify_password
from database.database import get_db
from database.models import UserCreate, UserLog, UserLogin, Users


def run_migrations():
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Runs at startup
    run_migrations()
    yield
    # Runs at shutdown (if needed)


# app = FastAPI(lifespan=lifespan)
app = FastAPI()


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="FastAPI application",
        version="1.0.0",
        description="JWT Authentication and Authorization",
        routes=app.routes,
    )
    if "components" not in openapi_schema:
        openapi_schema["components"] = {}
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }
    openapi_schema["security"] = [{"BearerAuth": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema



@app.post("/users/signup")
async def create_user(user: UserCreate, request: Request, db: Session = Depends(get_db)):
    hashed_pw = hash_password(user.password)
    new_user = Users(password=hashed_pw, type=user.type)
    db.add(new_user)
    db.flush()
    ip_addr = request.client.host if request.client is not None else ""
    user_log = UserLog(
        user_id=new_user.id,
        mac_addr=user.mac_addr,
        ip_addr=ip_addr,
        action="signup",
        time=datetime.now(),
    )
    db.add(user_log)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created", "id": new_user.id}


@app.post("/users/login")
async def login_for_access_token(
    user: UserLogin, request: Request, db: Session = Depends(get_db)
) -> Token:
    invalid_cred = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect user_id or password",
        headers={"WWW-Authenticate": "Bearer"},
    )
    db_user = db.query(Users).filter(Users.id == user.id).first()
    try:
        if not db_user or not verify_password(user.password, str(db_user.password)):
            raise invalid_cred

        ip_addr = request.client.host if request.client is not None else ""

        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(db_user.id)}, expires_delta=access_token_expires
        )
        user_log = UserLog(
            user_id=db_user.id,
            mac_addr=user.mac_addr,
            ip_addr=ip_addr,
            action="login",
            time=datetime.now(),
        )
        db.add(user_log)
        db.commit()
        return Token(access_token=access_token, token_type="bearer")
    except Exception as e:
        print(e)
        raise invalid_cred


@app.get("/temp")
async def wow(curr_user: Users = Security(get_current_user)):
    return curr_user.password


app.openapi = custom_openapi

# Run the app with `uvicorn`
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
