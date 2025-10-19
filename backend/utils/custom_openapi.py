from fastapi.openapi.utils import get_openapi


def get_custom_openapi(app):
    def custom_openapi():
        if app.openapi_schema:
            return app.openapi_schema
        openapi_schema = get_openapi(
            title="FastAPI application",
            version="1.0.0",
            description="JWT Authentication and Authorization",
            routes=app.routes,
        )
        if "components" not in openapi_schema:
            openapi_schema["components"] = {}
        openapi_schema["components"]["securitySchemes"] = {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            }
        }
        openapi_schema["security"] = [{"BearerAuth": []}]
        app.openapi_schema = openapi_schema
        return app.openapi_schema
    return custom_openapi
