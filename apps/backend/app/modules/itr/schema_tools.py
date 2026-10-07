"""
Helpers for building return JSON from the official e-filing schemas.

ITR-2 and ITR-3 have hundreds of mandatory numeric fields that are zero for a
typical salaried investor (presumptive business, partner income, AMT, ...).
`skeleton()` derives those from the schema itself — every required number is
0, every required object is present — so the builders only set the values
that come from the taxpayer's data. Required text fields with no single
allowed value are left as None and must be set by the builder; validation
against the schema catches any that are missed.
"""

import json
from functools import lru_cache
from pathlib import Path

from jsonschema import Draft4Validator

OFFICIAL_DIR = Path(__file__).parent / "official"


@lru_cache
def load_schema(schema_file: str) -> dict:
    return json.loads((OFFICIAL_DIR / schema_file).read_text())


@lru_cache
def validator(schema_file: str) -> Draft4Validator:
    return Draft4Validator(load_schema(schema_file))


def schema_errors(document: dict, schema_file: str) -> list[str]:
    errors = sorted(validator(schema_file).iter_errors(document), key=lambda e: list(e.absolute_path))
    return [f"{'/'.join(str(p) for p in e.absolute_path) or '(root)'}: {e.message}" for e in errors]


def _resolve(schema: dict, node: dict) -> dict:
    definitions = schema["definitions"]
    for _ in range(50):
        if "$ref" in node:
            node = definitions[node["$ref"].split("/")[-1]]
            continue
        if "allOf" in node and "properties" not in node and "type" not in node:
            merged: dict = {}
            for part in node["allOf"]:
                merged.update(_resolve(schema, part))
            merged.update({k: v for k, v in node.items() if k != "allOf"})
            node = merged
            continue
        break
    return node


def skeleton(schema: dict, node: dict):
    """Minimal instance of `node`: required properties only."""
    node = _resolve(schema, node)
    kind = node.get("type")
    if kind == "object" or "properties" in node:
        return {key: skeleton(schema, node["properties"][key]) for key in node.get("required", [])}
    if kind == "array":
        return [skeleton(schema, node["items"]) for _ in range(node.get("minItems", 0))]
    if kind in ("integer", "number"):
        minimum = node.get("minimum")
        return minimum if isinstance(minimum, (int, float)) and minimum > 0 else 0
    enum = node.get("enum")
    if enum and len(enum) == 1:
        return enum[0]
    return None


def form_node(schema_file: str) -> tuple[dict, dict]:
    schema = load_schema(schema_file)
    itr = _resolve(schema, schema["properties"]["ITR"])
    form_key = next(iter(itr["properties"]))
    return schema, _resolve(schema, itr["properties"][form_key])


def section_skeleton(schema_file: str, section: str):
    schema, node = form_node(schema_file)
    return skeleton(schema, node["properties"][section])


def form_skeleton(schema_file: str) -> dict:
    schema, node = form_node(schema_file)
    return skeleton(schema, node)


def merge(base, override):
    """Deep-merges `override` into `base` (override wins; lists replaced)."""
    if isinstance(base, dict) and isinstance(override, dict):
        out = dict(base)
        for key, value in override.items():
            out[key] = merge(base[key], value) if key in base else value
        return out
    return override


def prune_none(value):
    """Drops keys whose value is None (optional text the taxpayer didn't give)."""
    if isinstance(value, dict):
        return {k: prune_none(v) for k, v in value.items() if v is not None}
    if isinstance(value, list):
        return [prune_none(v) for v in value]
    return value


def complete(schema: dict, node: dict, value):
    """Walks `value` alongside the schema, adding every missing required
    field (numbers 0, objects filled recursively). Lets builders set only
    the meaningful values, including inside optional sections."""
    node = _resolve(schema, node)
    if isinstance(value, dict) and ("properties" in node or node.get("type") == "object"):
        props = node.get("properties", {})
        out = dict(value)
        for key in node.get("required", []):
            if key not in out:
                out[key] = skeleton(schema, props[key])
        return {k: complete(schema, props[k], v) if k in props else v for k, v in out.items()}
    if isinstance(value, list) and node.get("type") == "array":
        return [complete(schema, node["items"], v) for v in value]
    return value


def complete_form(schema_file: str, document: dict) -> dict:
    """`document` is {"ITR": {"ITR2": {...}}}; returns it with all required fields."""
    schema = load_schema(schema_file)
    return complete(schema, schema, document)
