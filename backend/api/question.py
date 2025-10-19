from datetime import datetime
from fastapi import (APIRouter, Depends, File, Form, HTTPException, Request,
                     UploadFile)
from sqlalchemy.orm import Session

from auth.jwt_utils import get_current_user
from database.database import get_db
from database.models import QuestionBank, UserLog, Users
from images.s3 import BUCKET_NAME, get_question_object_name, s3

router = APIRouter(prefix="/question", tags=["Question"])


@router.post("/create")
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
