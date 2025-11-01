from datetime import datetime

from fastapi import (APIRouter, Depends, File, Form, HTTPException, Request,
                     UploadFile)
from sqlalchemy.orm import Session

from auth.jwt_utils import get_current_user
from database.database import get_db
from database.models import (Examiners, GetQuestions, QuestionBank, UserLog,
                             Users, WorkbookStatus)
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
    db: Session = Depends(get_db),
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
        db.commit()
    except Exception as e:
        raise HTTPException(500, detail=f"While creating question paper: {e}")
    return {"message": "Paper created successfully"}


@router.post("/examiner/get_workbooks")
def get_examiner_pending_work(
    data: GetQuestions,
    request: Request,
    db: Session = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if str(curr_user.type) != "examiner":
        raise HTTPException(
            403, detail="Only examiners can get questions and workbooks"
        )

    paper_questions = (
        db.query(Examiners)
        .with_entities(Examiners.paper_id, Examiners.question_no)
        .filter_by(examiner_id=curr_user.id)
        .all()
    )
    if len(paper_questions) == 0:
        raise HTTPException(404, detail="No questions assigned to examiner")

    mapping = {}
    for paper_question in paper_questions:
        paper_id, question_no = paper_question
        if paper_id not in mapping:
            mapping[paper_id] = {}
        mapping[paper_id][question_no] = []
        workbooks = (
            db.query(WorkbookStatus)
            .with_entities(WorkbookStatus.workbook_id)
            .filter_by(question_no=question_no, checked=False)
            .all()
        )
        for workbook in workbooks:
            mapping[paper_id][question_no].append(workbook[0])

    try:
        ip_addr = request.client.host if request.client is not None else ""
        user_log = UserLog(
            user_id=curr_user.id,
            mac_addr=data.mac_addr,
            ip_addr=ip_addr,
            action="get_examiner_pending_work",
            time=datetime.now(),
        )
        db.add(user_log)
    except Exception as e:
        db.rollback()
        raise HTTPException(500, detail=f"While commiting in assign workbook: {e}")

    return {"data": mapping}


@router.post("/examiners/all_workbooks")
def get_workbooks_for_all_examiners(
    data: GetQuestions,
    request: Request,
    db: Session = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if str(curr_user.type) != "admin":
        raise HTTPException(
            403, detail="Only admins can get workbooks for all examiners"
        )

    paper_questions = (
        db.query(Examiners)
        .with_entities(Examiners.examiner_id, Examiners.paper_id, Examiners.question_no)
        .all()
    )

    mapping = {}
    for [examiner_id, paper_id, question_no] in paper_questions:
        if examiner_id not in mapping:
            mapping[examiner_id] = {}
        if paper_id not in mapping[examiner_id]:
            mapping[examiner_id][paper_id] = {}
        mapping[examiner_id][paper_id][question_no] = []
        workbooks = (
            db.query(WorkbookStatus)
            .with_entities(WorkbookStatus.workbook_id, WorkbookStatus.checked)
            .all()
        )
        for workbook in workbooks:
            mapping[examiner_id][paper_id][question_no].append(
                {"workbook_id": workbook[0], "status": workbook[1]}
            )

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
    except Exception as e:
        db.rollback()
        raise HTTPException(500, detail=f"While commiting in assign workbook: {e}")

    return {"data": mapping}
