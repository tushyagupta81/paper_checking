from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.jwt_utils import (ACCESS_TOKEN_EXPIRE_MINUTES, Token,
                            create_access_token, get_current_user)
from auth.utils import hash_password, verify_password
from database.database import get_db
from database.models import (AssignExaminer, AssignWorkbook, Examiners,
                             Images, QuestionBank, StudentWorkbook,
                             UnassignedExaminers, UserCreate, UserLog,
                             UserLogin, Users, WorkbookMarking,
                             WorkbookStatus)
from images.s3 import BUCKET_NAME, URL_EXPIRY, s3_public

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
    """
    Despite the route name (kept for backward compatibility with the
    frontend), this returns EVERY examiner — not just ones with zero
    assignments. An examiner can be assigned to many questions, so
    excluding anyone who already has one assignment made it impossible
    to give a busy examiner a second question. Each examiner's current
    question count is included so the admin can see workload at a glance.
    """
    if str(curr_user.type) != "admin":
        raise HTTPException(403, detail="Only admins can get unassigned examiners")
    try:
        all_examiners = (
            await db.execute(select(Users.id).where(Users.type == "examiner"))
        ).scalars().all()

        load_rows = (
            await db.execute(
                select(Examiners.examiner_id, Examiners.paper_id, Examiners.question_no)
            )
        ).all()
        load_counts = {}
        for eid, _, _ in load_rows:
            load_counts[eid] = load_counts.get(eid, 0) + 1

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
    return {
        "examiners": all_examiners,
        "examiner_load": {eid: load_counts.get(eid, 0) for eid in all_examiners},
    }


@router.post("/examiner/assign")
async def assign_examiner(
    examiner: AssignExaminer,
    request: Request,
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if str(curr_user.type) != "admin":
        raise HTTPException(403, detail="Only admins can assign questions to examiner")

    # Make sure the paper+question actually exists before assigning anyone
    # to it — gives a clear 404 instead of a foreign-key crash.
    question_exists = (
        await db.execute(
            select(QuestionBank).filter_by(
                paper_id=examiner.paper_id, question_no=examiner.question_no
            )
        )
    ).scalar_one_or_none()
    if question_exists is None:
        raise HTTPException(
            404,
            detail=f"Question {examiner.question_no} not found in paper '{examiner.paper_id}'",
        )

    # Clean duplicate check — same examiner + paper + question already
    # assigned — instead of letting it crash with a raw IntegrityError on
    # the composite primary key.
    already_assigned = (
        await db.execute(
            select(Examiners).filter_by(
                examiner_id=examiner.id,
                paper_id=examiner.paper_id,
                question_no=examiner.question_no,
            )
        )
    ).scalar_one_or_none()
    if already_assigned is not None:
        raise HTTPException(
            409,
            detail=f"Examiner #{examiner.id} is already assigned to question "
                   f"{examiner.question_no} of paper '{examiner.paper_id}'",
        )

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
    ).scalars().one_or_none()
    if student is None:
        raise HTTPException(404, detail="Student does not exist")
    if student != "student":
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


@router.get("/student/results")
async def get_student_results(
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    """
    Read-only endpoint for a logged-in student to view their own results.
    Returns every question across every workbook assigned to this student,
    with marks shown only for questions that have been checked.
    No image access, no edit capability — purely informational.
    """
    if str(curr_user.type) != "student":
        raise HTTPException(403, detail="Only students can view their own results")

    # All workbooks belonging to this student
    workbooks = (
        await db.execute(
            select(StudentWorkbook.workbook_id, StudentWorkbook.paper_id).filter_by(
                student_id=curr_user.id
            )
        )
    ).all()

    if not workbooks:
        return {"data": []}

    results = []
    for workbook_id, paper_id in workbooks:
        # Every question in this workbook + its checked status
        statuses = (
            await db.execute(
                select(WorkbookStatus.question_no, WorkbookStatus.checked).filter_by(
                    workbook_id=workbook_id
                )
            )
        ).all()

        question_rows = []
        for question_no, checked in statuses:
            max_marks = (
                await db.execute(
                    select(QuestionBank.max_marks).filter_by(
                        paper_id=paper_id, question_no=question_no
                    )
                )
            ).scalar_one_or_none()

            marks = None
            if checked:
                marks = (
                    await db.execute(
                        select(WorkbookMarking.marks).filter_by(
                            workbook_id=workbook_id, question_no=question_no
                        )
                    )
                ).scalar_one_or_none()

            question_rows.append(
                {
                    "question_no": question_no,
                    "checked": bool(checked),
                    "marks": marks,
                    "max_marks": max_marks,
                }
            )

        question_rows.sort(key=lambda q: q["question_no"])

        total_obtained = sum(q["marks"] for q in question_rows if q["marks"] is not None)
        total_max = sum(q["max_marks"] for q in question_rows if q["max_marks"] is not None)
        all_checked = all(q["checked"] for q in question_rows) if question_rows else False

        results.append(
            {
                "workbook_id": workbook_id,
                "paper_id": paper_id,
                "questions": question_rows,
                "total_obtained": total_obtained,
                "total_max": total_max,
                "fully_checked": all_checked,
            }
        )

    return {"data": results}


@router.post("/student/workbook/checked-images")
async def get_student_checked_images(
    workbook_id: str,
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    """
    Read-only endpoint for a student to view the checked (annotated) images
    of one of their own workbooks — exactly what the examiner marked, with
    pen/highlight/check/cross visible, baked into the image itself.

    Security: only returns data for a workbook that actually belongs to
    this student. A student can never view another student's workbook,
    regardless of what workbook_id they pass in.

    Only checked questions are included — a pending question simply won't
    appear, since there's no checked image to show yet.
    """
    if str(curr_user.type) != "student":
        raise HTTPException(403, detail="Only students can view their own checked workbooks")

    # Confirm this workbook actually belongs to the requesting student.
    owned = (
        await db.execute(
            select(StudentWorkbook.paper_id).filter_by(
                workbook_id=workbook_id, student_id=curr_user.id
            )
        )
    ).scalar_one_or_none()
    if owned is None:
        raise HTTPException(
            404, detail="Workbook not found, or it does not belong to you"
        )
    paper_id = owned

    # Every question in this workbook that has actually been checked.
    checked_questions = (
        await db.execute(
            select(WorkbookStatus.question_no)
            .filter_by(workbook_id=workbook_id, checked=True)
        )
    ).scalars().all()

    questions_data = []
    for question_no in sorted(checked_questions):
        marks = (
            await db.execute(
                select(WorkbookMarking.marks).filter_by(
                    workbook_id=workbook_id, question_no=question_no
                )
            )
        ).scalar_one_or_none()

        max_marks = (
            await db.execute(
                select(QuestionBank.max_marks).filter_by(
                    paper_id=paper_id, question_no=question_no
                )
            )
        ).scalar_one_or_none()

        comment = (
            await db.execute(
                select(WorkbookMarking.comment).filter_by(
                    workbook_id=workbook_id, question_no=question_no
                )
            )
        ).scalar_one_or_none()

        # Checked (annotated) images for this question, sorted by page.
        image_rows = (
            await db.execute(
                select(Images.page_no, Images.object_key).filter_by(
                    workbook_id=workbook_id, question_no=question_no, checked=True
                )
            )
        ).all()

        pages = []
        for page_no, object_key in sorted(image_rows, key=lambda r: r[0]):
            url = s3_public.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": BUCKET_NAME, "Key": object_key},
                ExpiresIn=URL_EXPIRY,
            )
            pages.append({"page_no": page_no, "url": url})

        questions_data.append(
            {
                "question_no": question_no,
                "marks": marks,
                "max_marks": max_marks,
                "comment": comment,
                "pages": pages,
            }
        )

    total_obtained = sum(q["marks"] for q in questions_data if q["marks"] is not None)
    total_max = sum(q["max_marks"] for q in questions_data if q["max_marks"] is not None)

    return {
        "workbook_id": workbook_id,
        "paper_id": paper_id,
        "questions": questions_data,
        "total_obtained": total_obtained,
        "total_max": total_max,
    }


#   all students results will be uploaded by using this
@router.get("/admin/results")
async def get_all_student_results(
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    """
    Admin-only endpoint that returns every student's results across all
    their workbooks. Same per-question shape as /student/results, but
    grouped under each student's user ID instead of filtered to one.
    Read-only — used to power the Reports page.
    """
    if str(curr_user.type) != "admin":
        raise HTTPException(403, detail="Only admins can view all student results")
 
    # Every student who has at least one workbook assigned
    student_ids = (
        await db.execute(select(StudentWorkbook.student_id).distinct())
    ).scalars().all()
 
    results = []
    for student_id in student_ids:
        workbooks = (
            await db.execute(
                select(StudentWorkbook.workbook_id, StudentWorkbook.paper_id).filter_by(
                    student_id=student_id
                )
            )
        ).all()
 
        student_workbooks = []
        for workbook_id, paper_id in workbooks:
            statuses = (
                await db.execute(
                    select(WorkbookStatus.question_no, WorkbookStatus.checked).filter_by(
                        workbook_id=workbook_id
                    )
                )
            ).all()
 
            question_rows = []
            for question_no, checked in statuses:
                max_marks = (
                    await db.execute(
                        select(QuestionBank.max_marks).filter_by(
                            paper_id=paper_id, question_no=question_no
                        )
                    )
                ).scalar_one_or_none()
 
                marks = None
                if checked:
                    marks = (
                        await db.execute(
                            select(WorkbookMarking.marks).filter_by(
                                workbook_id=workbook_id, question_no=question_no
                            )
                        )
                    ).scalar_one_or_none()
 
                question_rows.append(
                    {
                        "question_no": question_no,
                        "checked": bool(checked),
                        "marks": marks,
                        "max_marks": max_marks,
                    }
                )
 
            question_rows.sort(key=lambda q: q["question_no"])
 
            total_obtained = sum(q["marks"] for q in question_rows if q["marks"] is not None)
            total_max = sum(q["max_marks"] for q in question_rows if q["max_marks"] is not None)
            all_checked = all(q["checked"] for q in question_rows) if question_rows else False
 
            student_workbooks.append(
                {
                    "workbook_id": workbook_id,
                    "paper_id": paper_id,
                    "questions": question_rows,
                    "total_obtained": total_obtained,
                    "total_max": total_max,
                    "fully_checked": all_checked,
                }
            )
 
        results.append({"student_id": student_id, "workbooks": student_workbooks})
 
    return {"data": results}