import asyncio
from datetime import datetime
from typing import Optional

from fastapi import (APIRouter, Depends, File, Form, HTTPException, Request,
                     UploadFile)
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from auth.jwt_utils import get_current_user
from database.database import get_db
from database.models import (GetImages, Images, QuestionBank, StudentWorkbook,
                             UserLog, Users, WorkbookMarking, WorkbookStatus)
from images.s3 import BUCKET_NAME, URL_EXPIRY, get_obj_name, s3
from utils.mac_addr_type import MacAddress

router = APIRouter(prefix="/images", tags=["Images"])


@router.post("/upload/question")
async def upload_question_images(
    request: Request,
    workbook_id: str = Form(...),
    question_no: int = Form(...),
    files: list[UploadFile] = File(...),
    checked: bool = Form(...),
    marks: Optional[int] = Form(None),
    mac_addr: MacAddress = Form(...),
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if str(curr_user.type) != "admin":
        raise HTTPException(403, detail="Only admins can upload images")
    if checked and marks is None:
        raise HTTPException(400, detail="marks is required when checked is True")
    if all(not file.content_type.startswith("image/") for file in files):  # pyright: ignore[reportOptionalMemberAccess]
        raise HTTPException(status_code=400, detail="Invalid file type")

    paper_id = (
        await db.execute(
            select(StudentWorkbook.paper_id, QuestionBank.pages)
            .join(
                QuestionBank,
                (QuestionBank.paper_id == StudentWorkbook.paper_id)
                & (QuestionBank.question_no == question_no),
            )
            .filter(StudentWorkbook.workbook_id == workbook_id)
        )
    ).first()

    if paper_id is None:
        raise HTTPException(
            status_code=500, detail="Unable to find paper_id for workbook"
        )

    if len(files) != paper_id[1]:
        raise HTTPException(
            status_code=400,
            detail=f"Files should be equal to max number of pages. Reqires {paper_id[1]} pages, given {len(files)}, for '{paper_id[0]}', question no '{question_no}'",
        )

    paper_id = str(paper_id[0])
    try:
        for file in files:
            if file.filename is None:
                raise HTTPException(
                    status_code=500, detail="Filename should be the page number"
                )
            try:
                page_no = int(file.filename)
            except Exception as e:
                raise HTTPException(
                    status_code=500, detail=f"Filename is not an int. Error: {e}"
                )

            object_name = get_obj_name(
                workbook_id=workbook_id,
                paper_id=paper_id,
                question_no=question_no,
                page_no=page_no,
                checked=checked,
            )
            file_data = await file.read()

            await asyncio.to_thread(
                s3.put_object,
                Bucket=BUCKET_NAME,
                Key=object_name,
                Body=file_data,
                ContentType=file.content_type,
            )

            image_record = Images(
                workbook_id=workbook_id,
                question_no=question_no,
                page_no=page_no,
                checked=checked,
                object_key=object_name,
            )
            db.add(image_record)
            if checked:
                await db.execute(
                    update(WorkbookMarking)
                    .where(
                        WorkbookMarking.workbook_id == workbook_id,
                        WorkbookMarking.question_no == question_no,
                    )
                    .values(marks=marks, submit_time=datetime.now())
                )
                await db.execute(
                    update(WorkbookStatus)
                    .where(
                        WorkbookStatus.workbook_id == workbook_id,
                        WorkbookStatus.question_no == question_no,
                    )
                    .values(checked=True)
                )

        ip_addr = request.client.host if request.client is not None else ""
        user_log = UserLog(
            user_id=curr_user.id,
            mac_addr=mac_addr,
            ip_addr=ip_addr,
            action="upload_image",
            time=datetime.now(),
        )
        db.add(user_log)

        await db.commit()
        return {"message": "Upload successful"}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload/page")
async def upload_image(
    request: Request,
    workbook_id: str = Form(...),
    question_no: int = Form(...),
    page_no: int = Form(...),
    file: UploadFile = File(...),
    mac_addr: MacAddress = Form(...),
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if str(curr_user.type) != "admin":
        raise HTTPException(403, detail="Only admins can upload images")
    if file.content_type.startswith("image/"):  # pyright: ignore[reportOptionalMemberAccess]
        raise HTTPException(status_code=400, detail="Invalid file type")

    paper_id = (
        await db.execute(
            select(StudentWorkbook).filter(StudentWorkbook.workbook_id == workbook_id)
        )
    ).first()

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
        checked=False,
    )
    file_data = await file.read()

    try:
        await asyncio.to_thread(
            s3.put_object,
            Bucket=BUCKET_NAME,
            Key=object_name,
            Body=file_data,
            ContentType=file.content_type,
        )
        image_record = Images(
            workbook_id=workbook_id,
            question_no=question_no,
            checked=False,
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
        await db.commit()
        return {"message": "Upload successful"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/get")
async def get_images(
    images: GetImages,
    request: Request,
    db: AsyncSession = Depends(get_db),
    curr_user: Users = Depends(get_current_user),
):
    if str(curr_user.type) != "examiner":
        raise HTTPException(403, detail="Only examiners can fetch workbook images")
    urls = {}
    try:
        image_keys = (
            await db.execute(
                select(Images).filter(
                    Images.workbook_id == images.workbook_id,
                    Images.question_no == images.question_no,
                )
            )
        ).all()
        for image_key in image_keys:
            file_url = s3.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": BUCKET_NAME, "Key": image_key.object_key},
                ExpiresIn=URL_EXPIRY,  # seconds
            )
            urls[image_key.page_no] = file_url
        workbook_marking = WorkbookMarking(
            workbook_id=images.workbook_id,
            question_no=images.question_no,
            open_time=datetime.now(),
        )
        db.add(workbook_marking)
        ip_addr = request.client.host if request.client is not None else ""
        user_log = UserLog(
            user_id=curr_user.id,
            mac_addr=images.mac_addr,
            ip_addr=ip_addr,
            action="get_images",
            time=datetime.now(),
        )
        db.add(user_log)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, detail=f"While in get images: {e}")
    return {"urls": urls}
