import uuid

import pytest

from app.modules.funds.etf_catalogue import etf_list_for
from app.modules.funds.snapshot import adjust_history_for_splits, adjust_returns_for_splits

URL = "/api/v1/funds/etfs"


def _headers(client, dob=None) -> dict:
    response = client.post(
        "/api/v1/auth/signup",
        json={"name": "ETF Test", "email": f"etf-{uuid.uuid4()}@example.com", "password": "correct-horse-battery"},
    )
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    if dob:
        body = {"date_of_birth": dob, "employee_category": None, "expected_annual_income": None}
        assert client.put("/api/v1/recommendations/profile", json=body, headers=headers).status_code == 200
    return headers


@pytest.mark.parametrize("category, name, expected", [
    ("Exchange Traded Funds (ETFs) - Equity ETF", "Nippon India ETF Nifty 50 BeES", "nifty50"),
    ("Other Scheme - Other  ETFs", "Axis NIFTY Bank ETF", "bank"),
    ("Other Scheme - Other  ETFs", "Nippon India ETF Nifty PSU Bank BeES", None),
    ("Other Scheme - Other  ETFs", "Kotak Nifty Next 50 ETF", None),
    ("Other Scheme - Other  ETFs", "Nifty 50 Equal Weight ETF", None),
    ("Other Scheme - Other  ETFs", "Mirae Asset Nifty IT ETF", "it"),
    ("Exchange Traded Funds (ETFs) - Gold ETF", "HDFC Gold ETF", "gold"),
    ("Exchange Traded Funds (ETFs) - Silver ETF", "Axis Silver ETF", "silver"),
    ("Fund of Funds - Domestic", "Aditya Birla Sun Life Silver ETF FOF", None),
])
def test_groups_etfs_by_what_they_track(category, name, expected):
    found = etf_list_for(category, name)
    assert (found.id if found else None) == expected


def test_unit_split_is_not_a_crash():
    # Gold BeES split 1:100: the NAV per unit fell from ~3,419 to ~34.
    points = [["2023-01-31", 3400.0], ["2023-02-28", 3419.0], ["2023-03-31", 34.6], ["2023-04-28", 35.0]]
    adjusted = adjust_history_for_splits(points)
    assert [p[1] for p in adjusted] == [34.0, 34.19, 34.6, 35.0]

    rows = [{"one_year": r, "three_year": None, "five_year": None} for r in (20.6, 20.9, 21.0, -87.92)]
    fixed = adjust_returns_for_splits(rows)
    assert 18 < fixed[3]["one_year"] < 24  # corrected by the 1:10 split, in line with its peers

    # Even when most of a group split, the real return wins.
    rows = [{"one_year": None, "three_year": None, "five_year": r} for r in (8.62, 8.53, 8.52, -31.49, -31.48, -31.51)]
    assert all(8 < r["five_year"] < 9 for r in adjust_returns_for_splits(rows))


def test_lists_and_benchmarks(client):
    body = client.get(URL, headers=_headers(client)).json()

    assert [fl["id"] for fl in body["lists"]] == ["nifty50", "bank", "it", "gold", "silver"]
    for etf_list in body["lists"]:
        assert len(etf_list["funds"]) >= 5
        for fund in etf_list["funds"]:
            for key in ("one_year", "three_year", "five_year"):
                assert fund[key] is None or -60 < fund[key] < 120  # no split artefacts
    assert [b["id"] for b in body["benchmarks"]] == ["nifty50", "gold", "silver"]
    rows = {f["scheme_code"]: f for fl in body["lists"] for f in fl["funds"]}
    for benchmark in body["benchmarks"]:
        assert len(benchmark["history"]) >= 40
        assert benchmark["worst_fall"] > -60
    # A benchmark tile shows the same returns as its row in the table.
    nifty = body["benchmarks"][0]
    assert nifty["returns"]["one_year"] == next(
        f["one_year"] for f in rows.values() if f["name"] == "Nippon India ETF Nifty 50 BeES"
    )
    for etf_list in body["lists"]:
        for key in ("one_year", "three_year", "five_year"):
            assert etf_list["average"][key] is None or etf_list["average"][key] > -25
    assert body["mix"] is None


@pytest.mark.parametrize("dob, gold", [("2000-01-01", 10), ("1985-01-01", 15), ("1965-01-01", 25)])
def test_mix_follows_age(client, dob, gold):
    mix = client.get(URL, headers=_headers(client, dob)).json()["mix"]
    assert mix["gold"] == gold
    assert sum(mix.values()) == 100


def test_requires_authentication(client):
    assert client.get(URL).status_code == 401
