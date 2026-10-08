"""
Column type that encrypts the most sensitive fields of an ITR draft at rest.

Aadhaar, mobile, bank account numbers and the NPS PRAN are stored as Fernet
tokens (key: PII_ENCRYPTION_KEY, shared with PAN encryption on the user
profile). Encryption happens on write and decryption on read, so the rest of
the code always sees plain values. Rows written before this existed are read
as-is and encrypted on their next save.
"""

import copy

from cryptography.fernet import InvalidToken
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator

from app.modules.users.pii import _fernet

_PREFIX = "enc:v1:"
# (path to a dict, key) — "[]" walks every item of a list.
_SENSITIVE = [
    (("personal",), "aadhaar"),
    (("personal",), "mobile"),
    (("deductions",), "pran"),
    (("bank_accounts", "[]"), "account_no"),
]


def _targets(data: dict, path: tuple[str, ...]):
    nodes = [data]
    for part in path:
        next_nodes = []
        for node in nodes:
            if part == "[]" and isinstance(node, list):
                next_nodes.extend(n for n in node if isinstance(n, dict))
            elif isinstance(node, dict) and isinstance(node.get(part), (dict, list)):
                next_nodes.append(node[part])
        nodes = next_nodes
    return [n for n in nodes if isinstance(n, dict)]


def _transform(data, fn):
    if not isinstance(data, dict):
        return data
    data = copy.deepcopy(data)
    for path, key in _SENSITIVE:
        for node in _targets(data, path):
            value = node.get(key)
            if isinstance(value, str) and value:
                node[key] = fn(value)
    return data


def encrypt_value(value: str) -> str:
    if value.startswith(_PREFIX):
        return value
    return _PREFIX + _fernet().encrypt(value.encode()).decode()


def decrypt_value(value: str) -> str:
    if not value.startswith(_PREFIX):
        return value  # written before encryption was added
    try:
        return _fernet().decrypt(value[len(_PREFIX):].encode()).decode()
    except InvalidToken:
        return ""  # key changed: treat as missing rather than leak ciphertext into the form


class EncryptedDraftJSON(TypeDecorator):
    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        return dialect.type_descriptor(JSONB() if dialect.name == "postgresql" else JSON())

    def process_bind_param(self, value, dialect):
        return _transform(value, encrypt_value)

    def process_result_value(self, value, dialect):
        return _transform(value, decrypt_value)
