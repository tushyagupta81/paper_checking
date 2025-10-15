# Start from the official MinIO image
FROM quay.io/minio/minio:latest

# Expose MinIO ports
EXPOSE 9000 9001

# Environment variables
# Set default root credentials (override with podman run -e)
ENV MINIO_ROOT_USER=minioadmin
ENV MINIO_ROOT_PASSWORD=minioadmin123

# Create data directory and set permissions
RUN mkdir -p /data && chown -R 1000:1000 /data
VOLUME ["/data"]

# Healthcheck for MinIO API
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD curl -f http://localhost:9000/minio/health/live || exit 1

# Command: run MinIO server with console enabled
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
