import os
import random
from queue import Queue
from uuid import uuid4

import requests

MAC_ADDR = "12:12:12:12:12:12"
paper_code = ["ASX", "ABC", "ASM", "CAL", "AMS", "TOC", "ADA", "DSA", "DEF", "QWE"]
# image_dir = r"C:\Users\verma\Downloads"
image_dir = f"{os.environ.get('HOME')}/Downloads"
random_images = [
    os.path.join(image_dir, file)
    for file in os.listdir(image_dir)
    if file.endswith(".jpg") or file.endswith(".png")
]
PASSWORD = "Tushya@123"


def get_token():
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


def create_examiners(n=10):
    ids = []
    for i in range(n):
        res = requests.post(
            "http://localhost:8000/users/signup",
            json={
                "password": PASSWORD,
                "mac_addr": MAC_ADDR,
                "type": "examiner",
            },
        )
        ids.append(res.json()["id"])
        print(f"Created examiner: {ids[-1]}, {res.json()}")
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
                "pages": random.randint(2, 6),
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
                paper_ids[paper_id].append(
                    (data["question_no"], data["max_marks"], data["pages"])
                )
            else:
                print(f"Error: {res.json()}")
        print(f"Create {paper_id=}, with {[d for d in paper_ids[paper_id]]}")

    return paper_ids


def upload_workbook_images(workbooks: dict[str, str], papers: dict[str, list]):
    print("=== uploading images ===")
    for workbook_id in workbooks:
        paper_id = workbooks[workbook_id]
        for question, _, pages in papers[paper_id]:
            files = [
                (
                    "files",
                    (str(p), open(random.choice(random_images), "rb"), "image/jpeg"),
                )
                for p in range(1, pages + 1)
            ]
            res = requests.post(
                "http://localhost:8000/images/upload/question",
                headers={
                    "Authorization": f"Bearer {ADMIN_JWT}",
                },
                data={
                    "workbook_id": workbook_id,
                    "question_no": question + 1,
                    "mac_addr": MAC_ADDR,
                    "checked": False,
                },
                files=files,  # pyright: ignore[reportArgumentType]
            )
            if res.status_code != 200:
                print(res.text)
            print(f"Uploaded {workbook_id=}, question={question + 1}, {pages=}")


def assign_question_to_examiners(examiner_ids: list, paper_ids: dict[str, list]):
    q = Queue()
    for paper_id in paper_ids:
        for question_no, _, _ in paper_ids[paper_id]:
            q.put((paper_id, question_no))

    q = list(q.queue)
    n = len(q) - 3
    i = 0
    while i < n:
        json_data = {
            "id": random.choice(examiner_ids),
            "mac_addr": MAC_ADDR,
            "paper_id": q[i][0],
            "question_no": q[i][1],
        }
        _ = requests.post(
            "http://localhost:8000/users/examiner/assign",
            json=json_data,
            headers={
                "Authorization": f"Bearer {ADMIN_JWT}",
            },
        )
        print(
            f"Assigned examiner {json_data['id']} paper {q[i][0]} question_no {q[i][1]}"
        )
        i += 1


num_students = int(input("Number of students: "))
num_examiners = int(input("Number of examiners: "))
student_ids = create_students(num_students)
examiner_ids = create_examiners(num_examiners)
papers = create_question_bank(min(num_examiners, 15))
workbooks = assign_workbooks(student_ids, papers)
upload_workbook_images(workbooks, papers)
assign_question_to_examiners(examiner_ids, papers)
