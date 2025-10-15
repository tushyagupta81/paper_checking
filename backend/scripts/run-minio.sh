#!/usr/bin/env bash

podman run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -v $(pwd)/data:/data \
  -e MINIO_ROOT_USER=admin \
  -e MINIO_ROOT_PASSWORD=strongpassword \
  minio-server
