import os

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

load_dotenv()

database_url = os.environ["DATABASE_URL_SQLALCHEMY"]

engine = create_async_engine(database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
