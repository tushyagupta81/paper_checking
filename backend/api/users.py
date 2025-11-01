from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from auth.jwt_utils import (ACCESS_TOKEN_EXPIRE_MINUTES, Token,
                            create_access_token, get_current_user)
from auth.utils import hash_password, verify_password
from database.database import get_db
from database.models import (AssignExaminer, AssignWorkbook, Examiners,
                             QuestionBank, StudentWorkbook,
                             UnassignedExaminers, UserCreate, UserLog,
                             UserLogin, Users, WorkbookStatus)

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/signup")
async def create_user(
    user: UserCreate, request: Request, db: Session = Depends(get_db)
):
    try:
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
    except Exception as e:
        db.rollback()
        raise HTTPException(500, detail=f"While Creating new user: {e}")

    db.refresh(new_user)
    return {"message": "User created", "id": new_user.id}


@router.post("/login")
async def login_for_access_token(
    user: UserLogin, request: Request, db: Session = Depends(get_db)
):
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
        return {
            "token": Token(access_token=access_token, token_type="bearer"),
            "user_type": db_user.type,
        }
    except Exception as _:
        db.rollback()
        raise invalid_cred


@router.post("/examiner/unassigned")
async def get_unassigned_examiners(
    examiner: UnassignedExaminers,
    request: Request,
    db: Session = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if str(curr_user.type) != "admin":
        raise HTTPException(403, detail="Only admins can get unassigned examiners")
    try:
        subq = db.query(Examiners.examiner_id)
        examiners = (
            db.query(Users)
            .with_entities(Users.id)
            .filter(Users.type == "examiner")
            .filter(~Users.id.in_(subq))
            .all()
        )
        examiners = [x[0] for x in examiners]
        ip_addr = request.client.host if request.client is not None else ""
        user_log = UserLog(
            user_id=curr_user.id,
            mac_addr=examiner.mac_addr,
            ip_addr=ip_addr,
            action="get_unassigned_examiners",
            time=datetime.now(),
        )
        db.add(user_log)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            500, detail=f"While commiting in get unassigned examiners: {e}"
        )
    return {"examiners": examiners}


@router.post("/examiner/assign")
async def assign_examiner(
    examiner: AssignExaminer,
    request: Request,
    db: Session = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if str(curr_user.type) != "admin":
        raise HTTPException(403, detail="Only admins can assign questions to examiner")
    try:
        examiner_question = Examiners(
            examiner_id=examiner.id,
            paper_id=examiner.paper_id,
            question_no=examiner.question_no,
        )
        db.add(examiner_question)
        ip_addr = request.client.host if request.client is not None else ""
        user_log = UserLog(
            user_id=curr_user.id,
            mac_addr=examiner.mac_addr,
            ip_addr=ip_addr,
            action="assign_examiner",
            time=datetime.now(),
        )
        db.add(user_log)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, detail=f"While commiting in assign workbook: {e}")
    return {"message": "Assigned question to examiner"}


@router.post("/student/assign")
async def assign_workbook(
    workbook: AssignWorkbook,
    request: Request,
    db: Session = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if str(curr_user.type) != "admin":
        raise HTTPException(403, detail="Only admins can assign workbooks to students")
    student = (
        db.query(Users)
        .with_entities(Users.type)
        .filter_by(id=workbook.student_id)
        .all()
    )
    if len(student) == 0:
        raise HTTPException(404, detail="Student does not exist")
    student = student[0]
    if str(student[0]) != "student":
        raise HTTPException(403, detail="Only students can be assigned a workbook")

    paper_ids = db.query(QuestionBank).with_entities(QuestionBank.paper_id).all()
    paper_ids = set([x[0] for x in paper_ids])
    if workbook.paper_id not in paper_ids:
        raise HTTPException(404, detail="Paper id does not exist")

    try:
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
        questions = (
            db.query(QuestionBank)
            .with_entities(QuestionBank.question_no)
            .filter_by(paper_id=workbook.paper_id)
            .all()
        )
        for q in questions:
            workbook_status = WorkbookStatus(
                workbook_id=workbook.workbook_id,
                question_no=q[0],
                checked=False,
            )
            db.add(workbook_status)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, detail=f"While commiting in assign workbook: {e}")
    return {"message": "Assigned workbook to student"}
