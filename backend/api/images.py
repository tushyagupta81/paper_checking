from datetime import datetime

from fastapi import (APIRouter, Depends, File, Form, HTTPException, Request,
                     UploadFile)
from sqlalchemy.orm import Session

from auth.jwt_utils import get_current_user
from utils.mac_addr_type import MacAddress
from database.database import get_db
from database.models import (GetImages, Images, StudentWorkbook, UserLog,
                             Users, WorkbookMarking)
from images.s3 import BUCKET_NAME, URL_EXPIRY, get_obj_name, s3

router = APIRouter(prefix="/images", tags=["Images"])


@router.post("/upload")
async def upload_image(
    request: Request,
    workbook_id: str = Form(...),
    question_no: int = Form(...),
    page_no: int = Form(...),
    file: UploadFile = File(...),
    mac_addr: MacAddress = Form(...),
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
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/get")
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
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, detail=f"While in get images: {e}")
    return {"urls": urls}
