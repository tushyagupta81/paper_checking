from contextlib import asynccontextmanager

from fastapi import FastAPI

from alembic import command
from alembic.config import Config
from api import images, question, users
from utils.custom_openapi import get_custom_openapi


def run_migrations():
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Runs at startup
    run_migrations()
    yield
    # Runs at shutdown (if needed)


# app = FastAPI(lifespan=lifespan)
app = FastAPI()
app.include_router(users.router)
app.include_router(images.router)
app.include_router(question.router)

app.openapi = get_custom_openapi(app)

# Run the app with `uvicorn`
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
