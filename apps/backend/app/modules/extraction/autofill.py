"""
Merges extracted document data into an ITR draft — filling EMPTY fields only.

A field counts as empty when it is None, "" or 0. Values the user typed are
never overwritten. List rows (employers, TDS entries) are matched by TAN:
a matching row has its empty fields filled, otherwise a new row is added.

Every filled field is recorded in `sources` as {path: {label, value}} so the
UI can tag it ("from Form 16"). When the user later changes that value, the
tag is dropped (see `prune_sources`).
"""

from app.modules.extraction.parsers import Extraction
from app.modules.itr.schemas import ItrDraftData

SOURCE_LABELS = {
    "pan": "PAN card",
    "form16": "Form 16",
    "ais": "AIS",
    "payslips": "payslip",
    "form26as": "Form 26AS",
    "capital_gains": "broker statement",
}

# When two documents disagree, a more authoritative one may replace a value
# another document auto-filled (never a value the user typed or edited):
# the broker's tax P&L is net of charges, while the AIS only has gross figures.
SOURCE_PRIORITY = {"your account": 0, "AIS": 1, "payslip": 1, "Form 16": 2, "Form 26AS": 2, "PAN card": 3,
                   "broker statement": 3}


def _can_replace(path: str, current, sources: dict, label: str) -> bool:
    meta = sources.get(path)
    if meta is None or current != meta.get("value"):
        return False  # typed or edited by the user
    return SOURCE_PRIORITY.get(label, 0) > SOURCE_PRIORITY.get(meta.get("label"), 0)

_LIST_LIMITS = {
    "salary.employers": 10,
    "taxes_paid.tds_other": 20,
    "taxes_paid.tcs": 20,
    "deductions.section_80c": 20,
    "deductions.health_self.policies": 10,
    "deductions.health_parents.policies": 10,
    "capital_gains": 500,
}
_ROW_NAME_KEYS = ("name", "deductor_name", "collector_name", "insurer", "description")


def _is_empty(value) -> bool:
    return value is None or value == "" or value == 0


def _get(data: dict, path: str):
    node = data
    for part in path.split("."):
        if isinstance(node, list):
            index = int(part)
            if index >= len(node):
                return None
            node = node[index]
        elif isinstance(node, dict):
            node = node.get(part)
        else:
            return None
    return node


def _set(data: dict, path: str, value) -> None:
    *parents, last = path.split(".")
    node = data
    for part in parents:
        node = node[int(part)] if isinstance(node, list) else node.setdefault(part, {})
    node[last] = value


def _norm(name) -> str:
    return " ".join(str(name or "").lower().replace(".", " ").split())


def _row_name(row: dict) -> str:
    return next((_norm(row[k]) for k in _ROW_NAME_KEYS if row.get(k)), "")


def _match_row(list_path: str, items: list[dict], row: dict) -> int | None:
    """Same TAN, or — when either side has no TAN yet — the same name. A
    single existing employer is assumed to be the same employer when one
    side has no TAN (e.g. a payslip after an AIS row). A capital-gains sale
    is the same only with the same ISIN, sale date and sale value."""
    if list_path == "capital_gains":
        key = (row.get("isin"), row.get("sale_date"), row.get("sale_value"))
        return next(
            (i for i, item in enumerate(items) if (item.get("isin"), item.get("sale_date"), item.get("sale_value")) == key),
            None,
        )
    if row.get("tan"):
        for i, item in enumerate(items):
            if item.get("tan") == row["tan"]:
                return i
    name = _row_name(row)
    if name:
        for i, item in enumerate(items):
            if _row_name(item) == name and (
                not row.get("tan") or not item.get("tan")
            ):
                return i
    if list_path == "salary.employers" and len(items) == 1 and (not row.get("tan") or not items[0].get("tan")):
        return 0
    return None


def apply_extraction(
    draft: ItrDraftData, extraction: Extraction, label: str, sources: dict
) -> tuple[ItrDraftData, list[str]]:
    """Returns the updated draft and the list of paths that were filled."""
    data = draft.model_dump(mode="json")
    filled: list[str] = []

    for path, value in extraction.fields.items():
        current = _get(data, path)
        if _is_empty(current) or (current != value and _can_replace(path, current, sources, label)):
            _set(data, path, value)
            filled.append(path)

    for list_path, rows in extraction.rows.items():
        items = _get(data, list_path)
        if items is None:
            continue
        for row in rows:
            match = _match_row(list_path, items, row)
            if match is None:
                if len(items) >= _LIST_LIMITS.get(list_path, 10):
                    continue
                items.append({})
                match = len(items) - 1
            for key, value in row.items():
                current = items[match].get(key)
                path = f"{list_path}.{match}.{key}"
                if _is_empty(current) or (current != value and _can_replace(path, current, sources, label)):
                    items[match][key] = value
                    filled.append(path)

    updated = ItrDraftData.model_validate(data)
    # Re-read through the model so recorded values match what is stored (e.g. date normalisation).
    stored = updated.model_dump(mode="json")
    for path in filled:
        sources[path] = {"label": label, "value": _get(stored, path)}
    return updated, filled


def prune_sources(draft: ItrDraftData, sources: dict) -> dict:
    """Drops tags for fields whose value no longer matches the extracted one."""
    data = draft.model_dump(mode="json")
    return {path: meta for path, meta in sources.items() if _get(data, path) == meta.get("value")}


def _item_defaults(list_path: str) -> dict:
    """Default values of one row of `list_path` (e.g. section "94A")."""
    data: dict = {}
    _set(data, list_path, [{}])
    return _get(ItrDraftData.model_validate(data).model_dump(mode="json"), list_path)[0]


def clear_autofilled(draft: ItrDraftData, sources: dict) -> ItrDraftData:
    """Resets every field that still holds its auto-filled value, and drops
    list rows left with nothing the user typed. Used before re-reading all
    documents, so corrected parsers can fill them again."""
    data = draft.model_dump(mode="json")
    defaults = ItrDraftData().model_dump(mode="json")
    touched_lists: set[str] = set()
    for path, meta in sources.items():
        if _get(data, path) != meta.get("value"):
            continue  # edited by the user — keep
        parts = path.split(".")
        index = next((i for i, part in enumerate(parts) if part.isdigit()), None)
        if index is None:
            _set(data, path, _get(defaults, path))
            continue
        list_path = ".".join(parts[:index])
        _set(data, path, _item_defaults(list_path).get(parts[-1]))
        touched_lists.add(list_path)

    for list_path in touched_lists:
        row_defaults = _item_defaults(list_path)
        kept = [item for item in _get(data, list_path) or [] if item != row_defaults]
        _set(data, list_path, kept)
    return ItrDraftData.model_validate(data)
