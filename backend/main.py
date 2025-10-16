from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import (Depends, FastAPI, File, Form, HTTPException, Request,
                     UploadFile, status)
from fastapi.openapi.utils import get_openapi
from sqlalchemy.orm import Session

from alembic import command
from alembic.config import Config
from auth.jwt_utils import (ACCESS_TOKEN_EXPIRE_MINUTES, Token,
                            create_access_token, get_current_user)
from auth.utils import hash_password, verify_password
from database.database import get_db
from database.models import (AssignWorkbook, GetImages, Images, QuestionBank,
                             StudentWorkbook, UserCreate, UserLog, UserLogin,
                             Users)
from images.s3 import (BUCKET_NAME, URL_EXPIRY, get_obj_name,
                       get_question_object_name, s3)


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
async def create_user(
    user: UserCreate, request: Request, db: Session = Depends(get_db)
):
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


@app.post("/images/upload")
async def upload_image(
    request: Request,
    workbook_id: str = Form(...),
    question_no: int = Form(...),
    page_no: int = Form(...),
    file: UploadFile = File(...),
    mac_addr: str = Form(...),
    db: Session = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if not file.content_type.startswith("image/"):  # pyright: ignore[reportOptionalMemberAccess]
        raise HTTPException(status_code=400, detail="Invalid file type")

    paper_id = (
        db.query(StudentWorkbook)
        .filter(StudentWorkbook.workbook_id == workbook_id)
        .first()
    )
    if paper_id is None:
        raise HTTPException(
            status_code=500, detail="Unable to find paper_id for workbook"
        )
    paper_id = str(paper_id.paper_id)
    object_name = get_obj_name(
        workbook_id=workbook_id,
        paper_id=paper_id,
        question_no=question_no,
        page_no=page_no,
    )
    file_data = await file.read()

    try:
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=object_name,
            Body=file_data,
            ContentType=file.content_type,
        )
        image_record = Images(
            workbook_id=workbook_id,
            question_no=question_no,
            page_no=page_no,
            object_key=object_name,
        )
        db.add(image_record)
        ip_addr = request.client.host if request.client is not None else ""
        user_log = UserLog(
            user_id=curr_user.id,
            mac_addr=mac_addr,
            ip_addr=ip_addr,
            action="upload_image",
            time=datetime.now(),
        )
        db.add(user_log)
        db.commit()
        file_url = s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": BUCKET_NAME, "Key": object_name},
            ExpiresIn=URL_EXPIRY,  # seconds
        )
        return {"message": "Upload successful", "url": file_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/questions/create")
async def create_question_paper(
    request: Request,
    paper_id: str = Form(...),
    question_no: int = Form(...),
    max_marks: int = Form(...),
    file: UploadFile = File(...),
    mac_addr: str = Form(...),
    db: Session = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    question_object_key = get_question_object_name(
        paper_id=paper_id, question_no=question_no
    )
    file_data = await file.read()
    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=question_object_key,
        Body=file_data,
        ContentType=file.content_type,
    )
    qp = QuestionBank(
        paper_id=paper_id,
        question_no=question_no,
        question_key=question_object_key,
        max_marks=max_marks,
    )
    db.add(qp)
    ip_addr = request.client.host if request.client is not None else ""
    user_log = UserLog(
        user_id=curr_user.id,
        mac_addr=mac_addr,
        ip_addr=ip_addr,
        action="create_question_paper",
        time=datetime.now(),
    )
    db.add(user_log)
    db.commit()
    return {"message": "Paper created successfully"}


@app.post("/users/workbook/assign")
async def assign_workbook(
    workbook: AssignWorkbook,
    request: Request,
    db: Session = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    student_workbook = StudentWorkbook(
        student_id=workbook.student_id,
        workbook_id=workbook.workbook_id,
        paper_id=workbook.paper_id,
    )
    db.add(student_workbook)
    ip_addr = request.client.host if request.client is not None else ""
    user_log = UserLog(
        user_id=curr_user.id,
        mac_addr=workbook.mac_addr,
        ip_addr=ip_addr,
        action="assign_workbook",
        time=datetime.now(),
    )
    db.add(user_log)
    db.commit()
    return {"message": "Assigned workbook to student"}


@app.post("/images/get")
async def get_images(
    images: GetImages,
    request: Request,
    db: Session = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    urls = {}
    try:
        image_keys = (
            db.query(Images)
            .filter(
                Images.workbook_id == images.workbook_id,
                Images.question_no == images.question_no,
            )
            .all()
        )
        for image_key in image_keys:
            file_url = s3.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": BUCKET_NAME, "Key": image_key.object_key},
                ExpiresIn=URL_EXPIRY,  # seconds
            )
            urls[image_key.page_no] = file_url
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    ip_addr = request.client.host if request.client is not None else ""
    user_log = UserLog(
        user_id=curr_user.id,
        mac_addr=images.mac_addr,
        ip_addr=ip_addr,
        action="get_images",
        time=datetime.now(),
    )
    db.add(user_log)
    db.commit()
    return {"urls": urls}


app.openapi = custom_openapi

# Run the app with `uvicorn`
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
