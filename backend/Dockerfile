# syntax=docker/dockerfile:1
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc curl && \
    rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock* ./

RUN pip install --upgrade pip && \
    pip install uv && \
    uv pip install --system .

COPY . .

EXPOSE 8000
ENV PYTHONUNBUFFERED=1
ENV WATCHFILES_FORCE_POLLING=true
ENV LOG_LEVEL=debug
