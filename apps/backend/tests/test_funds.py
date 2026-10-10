import uuid
from datetime import date

import pytest

from app.modules.funds import amfi, service
from app.modules.funds.amfi import NavPoint, parse_history, parse_latest
from app.modules.funds.schemas import NavPointOut

URL = "/api/v1/funds/mutual-funds"


@pytest.fixture(autouse=True)
def _offline(monkeypatch):
    """Tests never call AMFI; each one says what the latest-NAV fetch returns."""
    amfi.latest_navs.clear()
    monkeypatch.setattr(amfi, "fetch_latest", lambda wanted, timeout=10.0: [])
    yield
    amfi.latest_navs.clear()


def _headers(client, **profile) -> dict:
    response = client.post(
        "/api/v1/auth/signup",
        json={"name": "Fund Test", "email": f"mf-{uuid.uuid4()}@example.com", "password": "correct-horse-battery"},
    )
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    if profile:
        body = {"date_of_birth": None, "employee_category": None, "expected_annual_income": None, **profile}
        assert client.put("/api/v1/recommendations/profile", json=body, headers=headers).status_code == 200
    return headers


def test_parses_amfi_files():
    latest = (
        "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date\n"
        "\nOpen Ended Schemes(Equity Scheme - Large Cap Fund)\n\n"
        "147794;INF247L01AE7;-;Motilal Oswal Nifty 50 Index Fund;Direct Plan;Growth;19.6657;09-Oct-2026\n"
        "100001;INF000000000;-;Other fund;Direct Plan;Growth;N.A.;09-Oct-2026\n"
    )
    assert parse_latest(latest, {147794, 100001}) == [NavPoint(147794, 19.6657, date(2026, 10, 9))]

    history = (
        "Scheme Code;NAV Name;Plan;Option;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Net Asset Value;Date\n"
        "147622;Motilal Oswal Nifty Midcap 150 Index Fund;Direct Plan;Growth;INF247L01916;;10.3692;30-Sep-2019\n"
        "120716;UTI Nifty 50 Index Fund;Direct Plan;Growth;INF789F01XA0;;93.3472;01-Jan-2021\n"
    )
    assert parse_history(history, {147622}) == [NavPoint(147622, 10.3692, date(2019, 9, 30))]


def test_returns_and_worst_fall():
    points = [NavPointOut(date=date(2020 + i, 10, 1), nav=nav) for i, nav in enumerate([100, 50, 80, 120, 130, 161.05])]
    assert service.cagr(points, 1) == 23.9  # 130 → 161.05
    assert service.cagr(points, 5) == 10.0  # 100 → 161.05 over 5 years
    assert service.cagr(points, 7) is None  # fund isn't that old
    assert service.worst_fall(points) == -50.0


def test_shows_real_history_for_all_three_caps(client):
    body = client.get(URL, headers=_headers(client)).json()

    assert [c["cap"] for c in body["categories"]] == ["large", "mid", "small"]
    for category in body["categories"]:
        assert len(category["history"]) >= 60  # five years of month-end NAVs
        assert category["returns"]["five_year"] is not None
        assert category["worst_fall"] < 0
    assert body["live"] is False
    assert "AMFI" in body["source"]


def test_lists_every_fund_with_category_average(client):
    body = client.get(URL, headers=_headers(client)).json()

    assert [fl["id"] for fl in body["fund_lists"]] == ["large", "mid", "small", "elss"]
    for fund_list in body["fund_lists"]:
        funds = fund_list["funds"]
        assert len(funds) >= 20
        three_year = [f["three_year"] for f in funds if f["three_year"] is not None]
        assert three_year == sorted(three_year, reverse=True)  # best 3-year return first
        assert fund_list["average"]["three_year"] is not None
    assert body["fund_lists"][3]["note"] and "80C" in body["fund_lists"][3]["note"]


def test_parses_categories_and_keeps_direct_growth_only():
    text = (
        "Open Ended Schemes(Equity Scheme - Large Cap Fund)\n\n"
        "1;X;-;Alpha Large Cap Fund;Direct Plan;Growth;50.5;09-Oct-2026\n"
        "2;X;-;Alpha Large Cap Fund;Regular Plan;Growth;48.1;09-Oct-2026\n"
        "3;X;-;Alpha Large Cap Fund;Direct Plan;IDCW;20.0;09-Oct-2026\n"
        "Open Ended Schemes(Equity Schemes - ELSS- Tax Saver Fund)\n"
        "4;X;-;Beta ELSS Tax Saver;Direct Plan;Growth Option;30.0;09-Oct-2026\n"
    )
    schemes = amfi.parse_latest_schemes(text)
    assert [(s.scheme_code, s.category) for s in schemes] == [
        (1, "Equity Scheme - Large Cap Fund"),
        (4, "Equity Schemes - ELSS- Tax Saver Fund"),
    ]
    from app.modules.funds.catalogue import fund_list_for
    assert [fund_list_for(s.category).id for s in schemes] == ["large", "elss"]
    assert fund_list_for("Equity Scheme - Large & Mid Cap Fund") is None


def test_latest_amfi_nav_is_added(client, monkeypatch):
    monkeypatch.setattr(amfi, "fetch_latest", lambda wanted, timeout=10.0: [NavPoint(147794, 25.0, date(2030, 1, 15))])
    body = client.get(URL, headers=_headers(client)).json()

    large = body["categories"][0]
    assert body["live"] is True
    assert large["latest_nav"] == 25.0
    assert large["history"][-1] == {"date": "2030-01-15", "nav": 25.0}
    assert body["as_of"] == "2030-01-15"


def test_amfi_down_falls_back_to_snapshot(client, monkeypatch):
    def down(wanted, timeout=10.0):
        raise amfi.httpx.ConnectError("AMFI unreachable")

    monkeypatch.setattr(amfi, "fetch_latest", down)
    response = client.get(URL, headers=_headers(client))
    assert response.status_code == 200
    assert response.json()["live"] is False


def test_no_recommendation_without_age(client):
    body = client.get(URL, headers=_headers(client)).json()
    assert body["recommendation"] is None
    assert body["missing"] == ["date_of_birth", "income"]


@pytest.mark.parametrize("dob, income, cap", [
    ("2000-01-01", 1_800_000, "small"),  # young, high income
    ("2000-01-01", 400_000, "mid"),      # young, low income
    ("1988-01-01", 1_000_000, "mid"),    # mid-career
    ("1972-01-01", 2_000_000, "large"),  # near retirement
])
def test_recommends_a_cap_from_age_and_income(client, dob, income, cap):
    body = client.get(URL, headers=_headers(client, date_of_birth=dob, expected_annual_income=income)).json()
    rec = body["recommendation"]
    assert rec["cap"] == cap
    assert sum(rec["mix"].values()) == 100
    assert rec["monthly_sip"] == max(500, round(income / 12 * 0.10 / 500) * 500)
    assert body["missing"] == []


def test_requires_authentication(client):
    assert client.get(URL).status_code == 401
