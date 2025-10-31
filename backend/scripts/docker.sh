#!/usr/bin/env bash

docker run -d --name minio -p 9000:9000 -p 9001:9001 -v "${PWD}/data:/data" my-minio