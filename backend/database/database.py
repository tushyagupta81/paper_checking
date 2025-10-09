import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()

database_url = os.environ.get("DATABASE_URL_SQLALCHEMY")
if database_url is None:
    print("Database url is missing in .env\nDATABASE_URL_SQLALCHEMY=?")
    exit(1)

engine = create_engine(database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
