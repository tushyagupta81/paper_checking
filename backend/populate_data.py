import os
import random
from uuid import uuid4

import requests

MAC_ADDR = "12:12:12:12:12:12"
paper_code = ["ASX", "ABC", "ASM", "CAL"]
image_dir = r"C:\Users\verma\Downloads"
random_images = [
    os.path.join(image_dir, file)
    for file in os.listdir(image_dir)
    if file.endswith(".jpg")
]
PASSWORD = "Tushya@123"


def get_token():
    # id = int(input("Enter id: "))
    # password = str(input("Enter password: "))

    admin_id = requests.post(
        "http://localhost:8000/users/signup",
        json={
            "password": PASSWORD,
            "mac_addr": MAC_ADDR,
            "type": "admin",
        },
    )
    admin_id = admin_id.json()["id"]
    examiner_id = requests.post(
        "http://localhost:8000/users/signup",
        json={
            "password": PASSWORD,
            "mac_addr": MAC_ADDR,
            "type": "examiner",
        },
    )
    examiner_id = examiner_id.json()["id"]

    res = requests.post(
        "http://localhost:8000/users/login",
        json={
            "id": admin_id,
            "password": PASSWORD,
            "mac_addr": MAC_ADDR,
        },
    )
    admin_token = res.json()["token"]["access_token"]
    res = requests.post(
        "http://localhost:8000/users/login",
        json={
            "id": examiner_id,
            "password": PASSWORD,
            "mac_addr": MAC_ADDR,
        },
    )
    examiner_token = res.json()["token"]["access_token"]

    return admin_id, admin_token, examiner_id, examiner_token


ADMIN_ID, ADMIN_JWT, EXAMINER_ID, EXAMINER_JWT = get_token()


def create_students(n=10):
    ids = []
    for i in range(n):
        res = requests.post(
            "http://localhost:8000/users/signup",
            json={
                "password": PASSWORD,
                "mac_addr": MAC_ADDR,
                "type": "student",
            },
        )
        ids.append(res.json()["id"])
        print(f"Created student: {ids[-1]}, {res.json()}")
    return ids


def assign_workbooks(student_ids: list[int], papers: dict[str, list]):
    workbooks = {}
    for id in student_ids:
        workbook_id = str(uuid4())
        json_data = {
            "student_id": id,
            "mac_addr": MAC_ADDR,
            "workbook_id": workbook_id,
            "paper_id": random.choice(list(papers.keys())),
        }
        res = requests.post(
            "http://localhost:8000/users/student/assign",
            json=json_data,
            headers={
                "Authorization": f"Bearer {ADMIN_JWT}",
            },
        )
        if res.status_code == 200:
            workbooks[workbook_id] = json_data["paper_id"]
            print(f"Created {workbook_id=}")
        else:
            print(res.json())

    return workbooks


def create_question_bank(n=10):
    paper_ids = {}
    for i in range(n):
        paper_id = f"{random.choice(paper_code)}{random.randint(100, 999)}"
        num_question = random.randint(1, 10)
        paper_ids[paper_id] = []
        for question_no in range(num_question):
            file_path = random.choice(random_images)
            data = {
                "paper_id": paper_id,
                "question_no": question_no,
                "max_marks": random.randint(2, 6),
                "mac_addr": MAC_ADDR,
            }
            res = requests.post(
                "http://localhost:8000/question/create",
                headers={
                    "Authorization": f"Bearer {ADMIN_JWT}",
                },
                data=data,
                files={"file": (file_path, open(file_path, "rb"), "image/jpeg")},
            )
            if res.status_code == 200:
                paper_ids[paper_id].append((data["question_no"], data["max_marks"]))
            else:
                print(f"Error: {res.json()}")
        print(f"Create {paper_id=}, with {[d for d in paper_ids[paper_id]]}")

    return paper_ids


def upload_workbook_images(workbooks: dict[str, str], papers: dict[str, list]):
    print("=== uploading images ===")
    for workbook_id in workbooks:
        paper_id = workbooks[workbook_id]
        page_no = 0
        for question, max_marks in papers[paper_id]:
            for page in range(random.randint(1, 3)):
                file_path = random.choice(random_images)
                res = requests.post(
                    "http://localhost:8000/images/upload",
                    headers={
                        "Authorization": f"Bearer {ADMIN_JWT}",
                    },
                    data={
                        "workbook_id": workbook_id,
                        "question_no": question + 1,
                        "page_no": page_no,
                        "mac_addr": MAC_ADDR,
                    },
                    files={"file": (file_path, open(file_path, "rb"), "image/jpeg")},
                )
                page_no += 1
                if res.status_code != 200:
                    print(res.text)
                print(f"Uploaded {workbook_id=}, question={question + 1}, {page_no=}")


num_students = int(input("Number of students: "))
student_ids = create_students(num_students)
papers = create_question_bank(num_students)
workbooks = assign_workbooks(student_ids, papers)
upload_workbook_images(workbooks, papers)