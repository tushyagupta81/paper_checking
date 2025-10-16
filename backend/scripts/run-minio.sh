#!/usr/bin/env bash

podman run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -v $(pwd)/data:/data \
  my-minio
