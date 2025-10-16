import os
import random
from uuid import uuid4

import requests

MAC_ADDR = "12:12:12:12:12:12"
paper_code = ["ASX", "ABC", "ASM", "CAL"]
image_dir = f"{os.environ.get('HOME')}/Downloads"
random_images = [
    os.path.join(image_dir, file)
    for file in os.listdir(image_dir)
    if file.endswith(".jpg")
]


def get_token():
    id = int(input("Enter id: "))
    password = str(input("Enter password: "))
    res = requests.post(
        "http://localhost:8000/users/login",
        json={
            "id": id,
            "password": password,
            "mac_addr": MAC_ADDR,
        },
    )
    return res.json()["access_token"]


JWT = get_token()


def create_students(n=10):
    ids = []
    for i in range(n):
        res = requests.post(
            "http://localhost:8000/users/signup",
            json={
                "password": "hello world",
                "mac_addr": MAC_ADDR,
                "type": "student",
            },
        )
        ids.append(res.json()["id"])
    return ids


def assign_workbooks(student_ids: list[int], papers: list[str]):
    workbooks = []
    for id, paper_id in zip(student_ids, papers):
        workbook_id = str(uuid4())
        res = requests.post(
            "http://localhost:8000/users/workbook/assign",
            json={
                "student_id": id,
                "mac_addr": MAC_ADDR,
                "workbook_id": workbook_id,
                "paper_id": paper_id,
            },
            headers={
                "Authorization": f"Bearer {JWT}",
            },
        )
        if res.status_code == 200:
            workbooks.append(workbook_id)

    return workbooks


def create_question_bank(n=10):
    paper_ids = []
    for i in range(n):
        paper_id = f"{random.choice(paper_code)}{random.randint(100, 999)}"
        num_question = random.randint(1, 10)
        for question_no in range(num_question):
            file_path = random.choice(random_images)
            res = requests.post(
                "http://localhost:8000/questions/create",
                headers={
                    "Authorization": f"Bearer {JWT}",
                },
                data={
                    "paper_id": paper_id,
                    "question_no": question_no,
                    "max_marks": random.randint(2, 6),
                    "mac_addr": MAC_ADDR,
                },
                files={"file": (file_path, open(file_path, "rb"), "image/jpeg")},
            )
        paper_ids.append(paper_id)

    return paper_ids


num_students = 10
student_ids = create_students(num_students)
papers = create_question_bank(num_students)
workbooks = assign_workbooks(student_ids, papers)
