import asyncio
from datetime import datetime

from fastapi import (APIRouter, Depends, File, Form, HTTPException, Request,
                    UploadFile)
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.jwt_utils import get_current_user
from database.database import get_db
from database.models import (Examiners, GetQuestions, QuestionBank,
                            StudentWorkbook, UserLog, Users, WorkbookStatus,
                            WorkbookMarking, WorkbookLog)
from images.s3 import BUCKET_NAME, URL_EXPIRY, get_question_object_name, s3, s3_public
from utils.mac_addr_type import MacAddress

router = APIRouter(prefix="/question", tags=["Question"])

class EvaluateQuestion(BaseModel):
    workbook_id:str
    question_no:int
    marks: int
    comment: str = ""
    mac_addr:MacAddress

@router.post("/create")
async def create_question_paper(
    request: Request,
    paper_id: str = Form(...),
    question_no: int = Form(...),
    max_marks: int = Form(...),
    pages: int = Form(...),
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
        await asyncio.to_thread(
            s3.put_object,
            Bucket=BUCKET_NAME,
            Key=question_object_key,
            Body=file_data,
            ContentType=file.content_type,
        )
        qp = QuestionBank(
            paper_id=paper_id,
            question_no=question_no,
            question_key=question_object_key,
            pages=pages,
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


@router.get("/papers")
async def list_papers(
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    """
    Returns every distinct Paper ID that has at least one question created
    for it. Powers the Paper ID dropdown on admin forms (Assign Workbook,
    Upload Images) so the admin picks from existing papers instead of
    retyping the same Paper ID by hand every time.
    """
    if str(curr_user.type) != "admin":
        raise HTTPException(403, detail="Only admins can list papers")

    result = await db.execute(
        select(QuestionBank.paper_id).distinct().order_by(QuestionBank.paper_id)
    )
    paper_ids = result.scalars().all()
    return {"paper_ids": paper_ids}


@router.get("/papers/{paper_id}/questions")
async def list_questions_for_paper(
    paper_id: str,
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    """
    Returns every question already created for this Paper ID, including
    each question's max_marks and pages (the page count set at creation
    time). Powers the Question Number dropdown — once a question is
    selected, its page count can be auto-filled instead of the admin
    re-typing a number that's already on record.
    """
    if str(curr_user.type) != "admin":
        raise HTTPException(403, detail="Only admins can list questions")

    result = await db.execute(
        select(
            QuestionBank.question_no,
            QuestionBank.max_marks,
            QuestionBank.pages,
        )
        .filter_by(paper_id=paper_id)
        .order_by(QuestionBank.question_no)
    )
    rows = result.all()
    if not rows:
        raise HTTPException(
            404, detail=f"No questions found for paper '{paper_id}'"
        )

    return {
        "paper_id": paper_id,
        "questions": [
            {"question_no": q, "max_marks": m, "pages": p}
            for q, m, p in rows
        ],
    }


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

    question_nos = [q for _, q in paper_question_pairs]

    # Outer join (not inner) so a WorkbookStatus row is never silently
    # dropped just because the StudentWorkbook join didn't match for some
    # reason — falling back to question_no filtering like the original
    # query did, so we don't lose workbooks that were showing up before.
    wb_result = await db.execute(
        select(
            WorkbookStatus.workbook_id,
            WorkbookStatus.question_no,
            WorkbookStatus.checked,
            StudentWorkbook.paper_id,
            WorkbookMarking.marks,
        )
        .outerjoin(
            StudentWorkbook,
            StudentWorkbook.workbook_id == WorkbookStatus.workbook_id,
        )
        .outerjoin(
            WorkbookMarking,
            (WorkbookMarking.workbook_id == WorkbookStatus.workbook_id)
            & (WorkbookMarking.question_no == WorkbookStatus.question_no),
        )
        .filter(
            WorkbookStatus.question_no.in_(question_nos),
        )
    )
    wb_rows = wb_result.all()

    # Build mapping: { paper_id: { question_no: { pending: [...], evaluated: [...] } } }
    mapping = {}
    pending_count = 0
    evaluated_count = 0

    # paper_id -> set of assigned question_nos, for quick lookup
    assigned_by_paper = {}
    for p, q in paper_question_pairs:
        assigned_by_paper.setdefault(p, set()).add(q)

    for wb_id, wb_qno, checked, wb_paper_id, marks in wb_rows:
        if wb_paper_id is not None:
            # Normal case: we know the workbook's real paper_id via the join.
            if wb_qno not in assigned_by_paper.get(wb_paper_id, set()):
                continue  
            effective_paper_id = wb_paper_id
        else:
            matches = [p for p, q in paper_question_pairs if q == wb_qno]
            if not matches:
                continue
            effective_paper_id = matches[0]

        mapping.setdefault(effective_paper_id, {}).setdefault(
            wb_qno, {"pending": [], "evaluated": []}
        )

        if checked:
            mapping[effective_paper_id][wb_qno]["evaluated"].append(
                {"workbook_id": wb_id, "marks": marks}
            )
            evaluated_count += 1
        else:
            mapping[effective_paper_id][wb_qno]["pending"].append(wb_id)
            pending_count += 1

    # Make sure every assigned paper+question shows up even with zero workbooks
    for paper_id, question_no in paper_question_pairs:
        mapping.setdefault(paper_id, {}).setdefault(
            question_no, {"pending": [], "evaluated": []}
        )

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

    return {
        "data": mapping,
        "summary": {
            "pending": pending_count,
            "evaluated": evaluated_count,
            "total": pending_count + evaluated_count,
        },
    }


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
        await db.execute(
            select(QuestionBank.paper_id, QuestionBank.question_no)
            .filter_by(active=True)
            .order_by(QuestionBank.created_at.desc())
        )
    ).all()

    examiners = (
        await db.execute(
            select(Examiners.examiner_id, Examiners.paper_id, Examiners.question_no)
        )
    ).all()
    examiner_mapping = {
        (paper_id, question_no): examiner_id
        for [examiner_id, paper_id, question_no] in examiners
    }

    assignments = [
        {
            "paper_id": paper_id,
            "question_no": question_no,
            "examiner_id": examiner_mapping.get((paper_id, question_no), "Unassigned"),
        }
        for [paper_id, question_no] in question_papers
    ]

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

    return {"data": result, "assignments": assignments}

"""
    Called by the examiner after marking a question.
    1. Verifies the examiner is assigned to this question.
    2. Validates marks are within the allowed max.
    3. Updates WorkbookMarking (marks + submit_time).
    4. Sets WorkbookStatus.checked = True.
    5. Writes a WorkbookLog audit entry.
    """

@router.post("/evaluate")
async def evaluate_workbook_question(
    data: EvaluateQuestion,
    request: Request,
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    # Role check 
    if str(curr_user.type) != "examiner":
        raise HTTPException(403, detail="Only examiners can evaluate workbooks")

    # check workbook exists.. and get it's paper id
    wb_result = await db.execute(
        select(StudentWorkbook.paper_id).filter_by(workbook_id=data.workbook_id)
    )
    student_workbook = wb_result.scalar_one_or_none()
    if student_workbook is None:
        raise HTTPException(404, detail=f"Workbook '{data.workbook_id}' not found")
 
    paper_id = student_workbook

    # Verifies the examiner is assigned to this paper and question
    examiner_result = await db.execute(
        select(Examiners).filter_by(
            examiner_id=curr_user.id,
            paper_id=paper_id,
            question_no=data.question_no,
        )
    )
    examiner_row = examiner_result.scalar_one_or_none()
    if examiner_row is None:
        raise HTTPException(
            403,
            detail=f"You are not assigned to question {data.question_no} of paper '{paper_id}'",
        )
    
    # validating marks vs max marks in question bank.. 

    qb_result = await db.execute(
        select(QuestionBank.max_marks).filter_by(
            paper_id=paper_id,
            question_no=data.question_no,
        )
    )
    max_marks = qb_result.scalar_one_or_none()
    if max_marks is None:
        raise HTTPException(
            404,
            detail=f"Question {data.question_no} not found in paper '{paper_id}'",
        )
    if data.marks < 0 or data.marks > max_marks:
        raise HTTPException(
            422,
            detail=f"Marks must be between 0 and {max_marks}. Got {data.marks}.",
        )
    
    # check whether it is already been submitted..
    status_result = await db.execute(
        select(WorkbookStatus).filter_by(
            workbook_id=data.workbook_id,
            question_no=data.question_no,
        )
    )
    workbook_status = status_result.scalar_one_or_none()
    if workbook_status is None:
        raise HTTPException(
            404,
            detail=f"WorkbookStatus row not found for workbook '{data.workbook_id}' Q{data.question_no}",
        )
    if workbook_status.checked:
        raise HTTPException(
            409,
            detail=f"Question {data.question_no} for workbook '{data.workbook_id}' has already been evaluated",
        )
    
    # fetching workbookMarking row
    marking_result = await db.execute(
        select(WorkbookMarking).filter_by(
            workbook_id=data.workbook_id,
            question_no=data.question_no,
        )
    )
    workbook_marking = marking_result.scalar_one_or_none()

    now = datetime.now()

    if workbook_marking is None:
        # Edge case: examiner submits without having opened images first.
        # Create the row with open_time = now so the DB constraint is satisfied.
        workbook_marking = WorkbookMarking(
            workbook_id=data.workbook_id,
            question_no=data.question_no,
            open_time=now,
            marks=data.marks,
            submit_time=now,
            comment=data.comment,
        )
        db.add(workbook_marking)
    else:
        # Normal path: just update marks and submit_time
        workbook_marking.marks = data.marks
        workbook_marking.submit_time = now
        workbook_marking.comment = data.comment

    # marking status = True
    workbook_status.checked = True

    # writing audit log
    # FIX: was "ip_add" here (typo) while ip_addr was used below, causing a
    # NameError on every single evaluate submission.
    ip_addr = request.client.host if request.client is not None else ""

    workbook_log = WorkbookLog(
        user_id=curr_user.id,
        mac_addr=data.mac_addr,
        ip_addr=ip_addr,
        action="evaluate_workbook_question",
        time=now,
        workbook_id=data.workbook_id,
        question_no=data.question_no,
        old_val=None,          # was unchecked, no previous marks
        new_val=data.marks,
    )
    db.add(workbook_log)

    user_log = UserLog(
        user_id=curr_user.id,
        mac_addr=data.mac_addr,
        ip_addr=ip_addr,
        action="evaluate_workbook_question",
        time=now,
    )
    db.add(user_log)

    # committing everything automatically
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, detail=f"While saving evaluation: {e}")

    return {
        "message": "Evaluation saved successfully",
        "workbook_id": data.workbook_id,
        "question_no": data.question_no,
        "marks": data.marks,
        "comment": data.comment,
        "submit_time": now.isoformat(),
    }


@router.get("/image")
async def get_question_image(
    paper_id: str,
    question_no: int,
    curr_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a presigned URL for the question's own image (the scanned
    question paper itself, uploaded by the admin via /question/create),
    so the frontend can display the question above the student's answer.
    """
    if str(curr_user.type) not in ("examiner", "admin"):
        raise HTTPException(403, detail="Not allowed to view question images")

    qb_result = await db.execute(
        select(QuestionBank.question_key).filter_by(
            paper_id=paper_id,
            question_no=question_no,
        )
    )
    question_key = qb_result.scalar_one_or_none()
    if question_key is None:
        raise HTTPException(
            404,
            detail=f"Question {question_no} not found in paper '{paper_id}'",
        )

    file_url = s3_public.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": BUCKET_NAME, "Key": question_key},
        ExpiresIn=URL_EXPIRY,
    )
    return {"url": file_url}