from typing import Any
from pydantic_core import core_schema
from pydantic import GetCoreSchemaHandler
import re

class MacAddress(str):
    @classmethod
    def __get_pydantic_core_schema__(cls, source: type[Any], handler: GetCoreSchemaHandler) -> core_schema.CoreSchema:
        return core_schema.no_info_after_validator_function(
            cls._validate,
            core_schema.str_schema(),
            serialization=core_schema.plain_serializer_function_ser_schema(
                cls._serialize,
                info_arg=False,
                return_schema=core_schema.str_schema(),
            ),
        )

    @staticmethod
    def _validate(value: str) -> 'MacAddress':
        pattern = r"^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$"
        if not isinstance(value, str) or not re.fullmatch(pattern, value):
            raise ValueError("Invalid MAC address")
        return MacAddress(value)

    @staticmethod
    def _serialize(value: 'MacAddress') -> str:
        return str(value)
