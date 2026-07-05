import os
from uuid import uuid4

import boto3

s3 = boto3.client(
    "s3",
    endpoint_url=os.environ.get("MINIO_ENDPOINT"),
    aws_access_key_id=os.getenv("MINIO_ACCESS_KEY"),
    aws_secret_access_key=os.getenv("MINIO_SECRET_KEY"),
)
s3_public = boto3.client(
    "s3",
    endpoint_url=os.environ.get("MINIO_PUBLIC_ENDPOINT", os.environ.get("MINIO_ENDPOINT")),
    aws_access_key_id=os.getenv("MINIO_ACCESS_KEY"),
    aws_secret_access_key=os.getenv("MINIO_SECRET_KEY"),
)

BUCKET_NAME = "images"
URL_EXPIRY = 5  # seconds 

try:
    s3.create_bucket(Bucket=BUCKET_NAME)
except s3.exceptions.BucketAlreadyOwnedByYou:
    pass

try:
    s3.put_bucket_cors(
        Bucket=BUCKET_NAME,
        CORSConfiguration={
            "CORSRules": [
                {
                    "AllowedOrigins": ["*"],
                    "AllowedMethods": ["GET"],
                    "AllowedHeaders": ["*"],
                    "MaxAgeSeconds": 3000,
                }
            ]
        },
    )
except Exception:
    pass


def get_obj_name(workbook_id: str, paper_id: str, question_no: int, page_no: int, checked: bool):
    object_name = (
        f"answer_sheet_{workbook_id}_{paper_id}_{question_no}_{page_no}_{str(checked)}_{str(uuid4())}"
    )
    return object_name


def get_question_object_name(paper_id: str, question_no: int):
    object_name = f"question_{paper_id}_{question_no}_{str(uuid4())}"
    return object_name

# # Single combined PDF holding every (annotated) page of one answer,
# # replacing the old one-object-per-page scheme for checked images.

# def get_checked_pdf_object_name(workbook_id: str, paper_id: str, question_no: int):
#     object_name = (
#         f"answer_sheet_{workbook_id}_{paper_id}_{question_no}_checked_{str(uuid4())}.pdf"
#     )
#     return object_name