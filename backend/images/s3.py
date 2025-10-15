import boto3

s3 = boto3.client(
    "s3",
    endpoint_url="http://localhost:9000",
    aws_access_key_id="minioadmin",
    aws_secret_access_key="minioadmin123",
)

BUCKET_NAME = "images"
URL_EXPIRY = 60

try:
    s3.create_bucket(Bucket=BUCKET_NAME)
except s3.exceptions.BucketAlreadyOwnedByYou:
    pass


def get_obj_name(workbook_id: int, paper_id: int, question_no: int, page_no: int):
    object_name = f"{workbook_id}_{paper_id}_{question_no}_{page_no}"
    return object_name
