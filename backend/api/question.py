from datetime import datetime

from fastapi import (APIRouter, Depends, File, Form, HTTPException, Request,
                     UploadFile)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.jwt_utils import get_current_user
from database.database import get_db
from database.models import (Examiners, GetQuestions, QuestionBank,
                             StudentWorkbook, UserLog, Users, WorkbookStatus)
from images.s3 import BUCKET_NAME, get_question_object_name, s3
from utils.mac_addr_type import MacAddress

router = APIRouter(prefix="/question", tags=["Question"])


@router.post("/create")
async def create_question_paper(
    request: Request,
    paper_id: str = Form(...),
    question_no: int = Form(...),
    max_marks: int = Form(...),
    file: UploadFile = File(...),
    mac_addr: MacAddress = Form(...),
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if str(curr_user.type) != "admin":
        raise HTTPException(403, detail="Only admins can create a question paper")
    try:
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
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, detail=f"While creating question paper: {e}")
    return {"message": "Paper created successfully"}


@router.post("/examiner/get_workbooks")
async def get_examiner_pending_work(
    data: GetQuestions,
    request: Request,
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if str(curr_user.type) != "examiner":
        raise HTTPException(
            403, detail="Only examiners can get questions and workbooks"
        )

    result = await db.execute(
        select(Examiners.paper_id, Examiners.question_no).filter_by(
            examiner_id=curr_user.id
        )
    )
    paper_questions = result.all()
    if not paper_questions:
        raise HTTPException(404, detail="No questions assigned to examiner")

    paper_question_pairs = [(p.paper_id, p.question_no) for p in paper_questions]

    question_nos = [p.question_no for p in paper_questions]

    wb_result = await db.execute(
        select(WorkbookStatus.workbook_id, WorkbookStatus.question_no)
        .filter(WorkbookStatus.checked == False)
        .filter(WorkbookStatus.question_no.in_(question_nos))
    )
    wb_rows = wb_result.all()

    # Build mapping
    mapping = {}
    for paper_id, question_no in paper_question_pairs:
        mapping.setdefault(paper_id, {}).setdefault(question_no, [])
        for wb_id, wb_qno in wb_rows:
            if wb_qno == question_no:
                mapping[paper_id][question_no].append(wb_id)

    try:
        ip_addr = request.client.host if request.client else ""
        user_log = UserLog(
            user_id=curr_user.id,
            mac_addr=data.mac_addr,
            ip_addr=ip_addr,
            action="get_examiner_pending_work",
            time=datetime.now(),
        )
        db.add(user_log)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, detail=f"While committing in assign workbook: {e}")

    return {"data": mapping}


@router.post("/examiners/all_workbooks")
async def get_workbooks_for_all_examiners(
    data: GetQuestions,
    request: Request,
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if str(curr_user.type) != "admin":
        raise HTTPException(
            403, detail="Only admins can get workbooks for all examiners"
        )

    query_stmt = (
        select(
            WorkbookStatus.workbook_id,
            StudentWorkbook.paper_id,
            WorkbookStatus.question_no,
            WorkbookStatus.checked,
            Examiners.examiner_id,
        )
        .join(
            StudentWorkbook,
            StudentWorkbook.workbook_id == WorkbookStatus.workbook_id,
        )
        .join(
            Examiners,
            (Examiners.paper_id == StudentWorkbook.paper_id)
            & (Examiners.question_no == WorkbookStatus.question_no),
        )
    )

    result = await db.execute(query_stmt)
    query = result.all()

    mapping = {}
    for workbook_id, paper_id, question_no, workbook_status, examiner_id in query:
        mapping.setdefault(examiner_id, {}).setdefault(paper_id, {}).setdefault(
            question_no, []
        ).append((workbook_id, workbook_status))

    try:
        ip_addr = request.client.host if request.client is not None else ""
        user_log = UserLog(
            user_id=curr_user.id,
            mac_addr=data.mac_addr,
            ip_addr=ip_addr,
            action="get_workbooks_for_all_examiners",
            time=datetime.now(),
        )
        db.add(user_log)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            500,
            detail=f"While committing in get all workbooks for all examiners: {e}",
        )

    return {"data": mapping}


@router.post("/assigned")
async def get_questions_assigned_to_all_examiners(
    data: GetQuestions,
    request: Request,
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if str(curr_user.type) != "admin":
        raise HTTPException(
            403, detail="Only admins can get workbooks for all examiners"
        )

    question_papers = (
        (
            await db.execute(
                select(QuestionBank.paper_id, QuestionBank.question_no).filter_by(
                    active=True
                )
            )
        )
        .all()
    )

    examiners = (
        await db.execute(
            select(Examiners.examiner_id, Examiners.paper_id, Examiners.question_no)
        )
    ).all()
    examiner_mapping = {
        (paper_id, question_no): examiner_id
        for [examiner_id, paper_id, question_no] in examiners
    }

    result = {}
    for [paper_id, question_no] in question_papers:
        examiner_id = examiner_mapping.get((paper_id, question_no), "Unassigned")
        result.setdefault(paper_id, {})[question_no] = examiner_id

    try:
        ip_addr = request.client.host if request.client is not None else ""
        user_log = UserLog(
            user_id=curr_user.id,
            mac_addr=data.mac_addr,
            ip_addr=ip_addr,
            action="get_questions_assigned_to_all_examiners",
            time=datetime.now(),
        )
        db.add(user_log)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            500,
            detail=f"While commiting in get all questions assigned to examiners: {e}",
        )

    return {"data": result}
