from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    user: UserCreate, request: Request, db: AsyncSession = Depends(get_db)
):
    try:
        hashed_pw = hash_password(user.password)
        new_user = Users(password=hashed_pw, type=user.type)
        db.add(new_user)
        await db.flush()
        ip_addr = request.client.host if request.client is not None else ""
        user_log = UserLog(
            user_id=new_user.id,
            mac_addr=user.mac_addr,
            ip_addr=ip_addr,
            action="signup",
            time=datetime.now(),
        )
        db.add(user_log)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, detail=f"While Creating new user: {e}")

    await db.refresh(new_user)
    return {"message": "User created", "id": new_user.id}


@router.post("/login")
async def login_for_access_token(
    user: UserLogin, request: Request, db: AsyncSession = Depends(get_db)
):
    invalid_cred = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect user_id or password",
        headers={"WWW-Authenticate": "Bearer"},
    )
    db_user = (await db.execute(select(Users).filter(Users.id == user.id))).first()
    try:
        if not db_user or not verify_password(user.password, str(db_user[0].password)):
            raise invalid_cred
        else:
            db_user = db_user[0]

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
        await db.commit()
    except Exception as _:
        await db.rollback()
        raise invalid_cred

    return {
        "token": Token(access_token=access_token, token_type="bearer"),
        "user_type": db_user.type,
    }


@router.post("/examiner/unassigned")
async def get_unassigned_examiners(
    examiner: UnassignedExaminers,
    request: Request,
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if str(curr_user.type) != "admin":
        raise HTTPException(403, detail="Only admins can get unassigned examiners")
    try:
        subq = select(Examiners.examiner_id)
        result = await db.execute(
            select(Users.id).where(Users.type == "examiner").where(~Users.id.in_(subq))
        )
        examiners = result.scalars().all()
        ip_addr = request.client.host if request.client is not None else ""
        user_log = UserLog(
            user_id=curr_user.id,
            mac_addr=examiner.mac_addr,
            ip_addr=ip_addr,
            action="get_unassigned_examiners",
            time=datetime.now(),
        )
        db.add(user_log)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            500, detail=f"While commiting in get unassigned examiners: {e}"
        )
    return {"examiners": examiners}


@router.post("/examiner/assign")
async def assign_examiner(
    examiner: AssignExaminer,
    request: Request,
    db: AsyncSession = Depends(get_db),
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
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, detail=f"While commiting in assign workbook: {e}")
    return {"message": "Assigned question to examiner"}


@router.post("/student/assign")
async def assign_workbook(
    workbook: AssignWorkbook,
    request: Request,
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if str(curr_user.type) != "admin":
        raise HTTPException(403, detail="Only admins can assign workbooks to students")
    student = (
        await db.execute(select(Users.type).filter_by(id=workbook.student_id))
    ).one()
    if len(student) == 0:
        raise HTTPException(404, detail="Student does not exist")
    student = student[0]
    if str(student[0]) != "student":
        raise HTTPException(403, detail="Only students can be assigned a workbook")

    paper_ids = set((await db.execute(select(QuestionBank.paper_id))).scalars().all())
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
            await db.execute(
            select(QuestionBank.question_no)
            .filter_by(paper_id=workbook.paper_id))
        ).scalars().all()
        for q in questions:
            workbook_status = WorkbookStatus(
                workbook_id=workbook.workbook_id,
                question_no=q,
                checked=False,
            )
            db.add(workbook_status)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, detail=f"While commiting in assign workbook: {e}")
    return {"message": "Assigned workbook to student"}
