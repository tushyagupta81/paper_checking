import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from alembic import command
from alembic.config import Config
from api import images, question, users
from utils.custom_openapi import get_custom_openapi


async def run_migrations():
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _run_sync_migrations)


def _run_sync_migrations():
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await run_migrations()
    yield


app = FastAPI(lifespan=lifespan, debug=True)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(images.router)
app.include_router(question.router)

app.openapi = get_custom_openapi(app)

# Run the app with `uvicorn`
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app", host="0.0.0.0", port=8000, log_level="debug", access_log=True
    )
