"""The Goals API: goals, contributions, plans and affordability, per signed-in user."""

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy import event, update

from app.modules.goals.models import Goal
from app.modules.goals.planner import GOAL_DISCLOSURE, MAX_GOAL_AMOUNT
from app.modules.planning.fy import current_financial_year
from tests.conftest import TestSessionLocal, engine

GOALS = "/api/v1/goals"
PROFILE = "/api/v1/users/me/financial-profile"


def _months_ahead(months: int, day: int = 15) -> str:
    today = date.today()
    index = today.year * 12 + today.month - 1 + months
    return date(index // 12, index % 12 + 1, day).isoformat()


def _signup(client) -> dict:
    response = client.post(
        "/api/v1/auth/signup",
        json={"name": "Goal Test", "email": f"goal-{uuid.uuid4()}@example.com", "password": "correct-horse-battery"},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def alice(client):
    return _signup(client)


@pytest.fixture
def bob(client):
    return _signup(client)


def _goal_body(**overrides) -> dict:
    body = {"title": "Car", "goal_type": "car", "target_date": _months_ahead(6), "cost_today": 800_000,
            "existing_savings": 300_000}
    return body | overrides


def _create(client, headers, **overrides) -> dict:
    response = client.post(GOALS, headers=headers, json=_goal_body(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


def _contribute(client, headers, goal_id, amount=10_000, on=None, note=None):
    body = {"amount": amount, "contributed_on": on or date.today().isoformat(), "note": note}
    return client.post(f"{GOALS}/{goal_id}/contributions", headers=headers, json=body)


def _profile(client, headers, take_home=None, expenses=None):
    response = client.put(PROFILE, headers=headers, json={"monthly_take_home": take_home, "monthly_expenses": expenses})
    assert response.status_code == 200, response.text


def _errors_for(response, field: str) -> list:
    assert response.status_code == 422, response.text
    return [e for e in response.json()["detail"] if e["loc"][-1] == field]


# ---------------------------------------------------------------------------
# Creating and reading goals
# ---------------------------------------------------------------------------


def test_goals_need_authentication(client):
    assert client.get(GOALS).status_code == 401
    assert client.post(GOALS, json=_goal_body()).status_code == 401


def test_create_goal_returns_a_calculated_plan(client, alice):
    goal = _create(client, alice)
    assert goal["status"] == "active" and goal["completed_at"] is None
    assert goal["contributions_total"] == 0
    assert goal["current_funding"] == 300_000
    plan = goal["plan"]
    assert plan["months"] == 6
    assert plan["funding_counted"] == 300_000
    assert plan["remaining"] == plan["future_cost"] - 300_000
    assert plan["approach"]["key"] == "short_term"
    assert plan["monthly_needed"] > 0 and plan["monthly_needed"] % 100 == 0
    assert plan["disclosure"] == GOAL_DISCLOSURE
    assert any("before tax" in line for line in plan["assumptions"])
    assert any("no growth" in line for line in plan["assumptions"])
    assert goal["plan_issue"] is None


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"target_date": date.today().isoformat()}, "target_date"),
        ({"target_date": (date.today() - timedelta(days=40)).isoformat()}, "target_date"),
        ({"target_date": _months_ahead(481)}, "target_date"),
        ({"cost_today": 99}, "cost_today"),
        ({"cost_today": MAX_GOAL_AMOUNT + 1}, "cost_today"),
        ({"cost_today": 800_000.5}, "cost_today"),
        ({"cost_today": True}, "cost_today"),
        ({"cost_today": "800000"}, "cost_today"),
        ({"existing_savings": -1}, "existing_savings"),
        ({"existing_savings": 1.5}, "existing_savings"),
        ({"title": "   "}, "title"),
        ({"title": "x" * 101}, "title"),
        ({"goal_type": "yacht"}, "goal_type"),
        ({"surprise": 1}, "surprise"),
    ],
)
def test_create_goal_validation(client, alice, overrides, field):
    response = client.post(GOALS, headers=alice, json=_goal_body(**overrides))
    errors = _errors_for(response, field)
    assert errors, response.json()
    assert "input" not in errors[0]  # submitted values are never echoed back


def test_title_is_trimmed(client, alice):
    assert _create(client, alice, title="  New car  ")["title"] == "New car"


def test_list_shows_only_my_goals_and_hides_archived(client, alice, bob):
    kept = _create(client, alice, title="Car")
    archived = _create(client, alice, title="Old plan", goal_type="travel")
    _create(client, bob, title="Bob's house", goal_type="house")
    assert client.post(f"{GOALS}/{archived['id']}/archive", headers=alice).status_code == 200

    listed = client.get(GOALS, headers=alice).json()
    assert [g["id"] for g in listed] == [kept["id"]]
    everything = client.get(GOALS, headers=alice, params={"include_archived": True}).json()
    assert {g["id"] for g in everything} == {kept["id"], archived["id"]}


def test_get_goal(client, alice):
    goal = _create(client, alice)
    fetched = client.get(f"{GOALS}/{goal['id']}", headers=alice)
    assert fetched.status_code == 200
    assert fetched.json()["id"] == goal["id"]
    assert client.get(f"{GOALS}/{uuid.uuid4()}", headers=alice).status_code == 404


def test_update_goal_replaces_its_details(client, alice):
    goal = _create(client, alice)
    response = client.put(f"{GOALS}/{goal['id']}", headers=alice,
                          json=_goal_body(title="Bigger car", cost_today=1_000_000, target_date=_months_ahead(12)))
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["title"] == "Bigger car"
    assert updated["cost_today"] == 1_000_000
    assert updated["plan"]["months"] == 12
    assert updated["updated_at"] >= goal["updated_at"]


def test_update_goal_is_validated(client, alice):
    goal = _create(client, alice)
    response = client.put(f"{GOALS}/{goal['id']}", headers=alice, json=_goal_body(cost_today=50))
    assert _errors_for(response, "cost_today")


# ---------------------------------------------------------------------------
# Status, archiving and deleting
# ---------------------------------------------------------------------------


def test_complete_and_reopen_set_and_clear_completed_at(client, alice):
    goal = _create(client, alice)
    completed = client.post(f"{GOALS}/{goal['id']}/complete", headers=alice).json()
    assert completed["status"] == "completed"
    assert completed["completed_at"] is not None
    assert completed["plan"] is None and completed["affordability"] is None
    assert "Reopen" in completed["plan_issue"]

    reopened = client.post(f"{GOALS}/{goal['id']}/reopen", headers=alice).json()
    assert reopened["status"] == "active"
    assert reopened["completed_at"] is None
    assert reopened["plan"] is not None


def test_archive_keeps_contributions_and_clears_completed_at(client, alice):
    goal = _create(client, alice)
    assert _contribute(client, alice, goal["id"], 5_000).status_code == 201
    client.post(f"{GOALS}/{goal['id']}/complete", headers=alice)
    archived = client.post(f"{GOALS}/{goal['id']}/archive", headers=alice).json()
    assert archived["status"] == "archived"
    assert archived["completed_at"] is None
    assert archived["contributions_total"] == 5_000
    assert len(client.get(f"{GOALS}/{goal['id']}/contributions", headers=alice).json()) == 1


def test_invalid_status_changes_are_rejected(client, alice):
    goal = _create(client, alice)
    client.post(f"{GOALS}/{goal['id']}/archive", headers=alice)
    assert client.post(f"{GOALS}/{goal['id']}/complete", headers=alice).status_code == 409
    # Archived and completed goals must be reopened before editing.
    assert client.put(f"{GOALS}/{goal['id']}", headers=alice, json=_goal_body()).status_code == 409
    # Repeating a change is harmless.
    assert client.post(f"{GOALS}/{goal['id']}/archive", headers=alice).status_code == 200


def test_delete_goal_without_contributions(client, alice):
    goal = _create(client, alice)
    assert client.delete(f"{GOALS}/{goal['id']}", headers=alice).status_code == 204
    assert client.get(f"{GOALS}/{goal['id']}", headers=alice).status_code == 404


def test_delete_goal_with_contributions_is_refused(client, alice):
    goal = _create(client, alice)
    _contribute(client, alice, goal["id"])
    response = client.delete(f"{GOALS}/{goal['id']}", headers=alice)
    assert response.status_code == 409
    assert "Archive it instead" in response.json()["detail"]
    assert client.get(f"{GOALS}/{goal['id']}", headers=alice).status_code == 200


# ---------------------------------------------------------------------------
# Another user's goals
# ---------------------------------------------------------------------------


def test_another_users_goal_is_not_found(client, alice, bob):
    goal = _create(client, alice)
    _contribute(client, alice, goal["id"])
    contribution_id = client.get(f"{GOALS}/{goal['id']}/contributions", headers=alice).json()[0]["id"]
    base = f"{GOALS}/{goal['id']}"
    contribution = {"amount": 1_000, "contributed_on": date.today().isoformat()}

    attempts = [
        client.get(base, headers=bob),
        client.put(base, headers=bob, json=_goal_body(title="Mine now")),
        client.post(f"{base}/archive", headers=bob),
        client.post(f"{base}/complete", headers=bob),
        client.post(f"{base}/reopen", headers=bob),
        client.delete(base, headers=bob),
        client.get(f"{base}/contributions", headers=bob),
        client.post(f"{base}/contributions", headers=bob, json=contribution),
        client.put(f"{base}/contributions/{contribution_id}", headers=bob, json=contribution),
        client.delete(f"{base}/contributions/{contribution_id}", headers=bob),
    ]
    assert [r.status_code for r in attempts] == [404] * len(attempts)

    # Nothing changed for Alice.
    mine = client.get(base, headers=alice).json()
    assert mine["title"] == "Car" and mine["status"] == "active" and mine["contributions_total"] == 10_000


def test_contribution_must_be_reached_through_its_own_goal(client, alice):
    first, second = _create(client, alice), _create(client, alice, title="Bike")
    _contribute(client, alice, first["id"])
    contribution_id = client.get(f"{GOALS}/{first['id']}/contributions", headers=alice).json()[0]["id"]
    wrong = f"{GOALS}/{second['id']}/contributions/{contribution_id}"
    assert client.delete(wrong, headers=alice).status_code == 404
    assert client.put(wrong, headers=alice, json={"amount": 1, "contributed_on": date.today().isoformat()}).status_code == 404


# ---------------------------------------------------------------------------
# Contributions
# ---------------------------------------------------------------------------


def test_contributions_are_listed_in_date_order(client, alice):
    goal = _create(client, alice)
    today = date.today()
    for days_ago in (3, 30, 10):
        assert _contribute(client, alice, goal["id"], on=(today - timedelta(days=days_ago)).isoformat()).status_code == 201
    dates = [c["contributed_on"] for c in client.get(f"{GOALS}/{goal['id']}/contributions", headers=alice).json()]
    assert dates == sorted(dates)


def test_contribution_note_is_trimmed_and_optional(client, alice):
    goal = _create(client, alice)
    assert _contribute(client, alice, goal["id"], note="  October SIP  ").json()["note"] == "October SIP"
    assert _contribute(client, alice, goal["id"], note="   ").json()["note"] is None


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"amount": 0}, "amount"),
        ({"amount": -500}, "amount"),
        ({"amount": MAX_GOAL_AMOUNT + 1}, "amount"),
        ({"amount": 10.5}, "amount"),
        ({"amount": True}, "amount"),
        ({"contributed_on": (date.today() + timedelta(days=1)).isoformat()}, "contributed_on"),
        ({"note": "x" * 201}, "note"),
        ({"extra": "no"}, "extra"),
    ],
)
def test_contribution_validation(client, alice, body, field):
    goal = _create(client, alice)
    payload = {"amount": 1_000, "contributed_on": date.today().isoformat()} | body
    response = client.post(f"{GOALS}/{goal['id']}/contributions", headers=alice, json=payload)
    assert _errors_for(response, field)


def test_contributions_need_an_active_goal(client, alice):
    goal = _create(client, alice)
    client.post(f"{GOALS}/{goal['id']}/archive", headers=alice)
    assert _contribute(client, alice, goal["id"]).status_code == 409


def test_editing_and_deleting_contributions(client, alice):
    goal = _create(client, alice)
    created = _contribute(client, alice, goal["id"], 10_000).json()
    url = f"{GOALS}/{goal['id']}/contributions/{created['id']}"

    edited = client.put(url, headers=alice, json={"amount": 12_000, "contributed_on": date.today().isoformat()})
    assert edited.status_code == 200
    assert edited.json()["amount"] == 12_000
    assert client.get(f"{GOALS}/{goal['id']}", headers=alice).json()["contributions_total"] == 12_000

    assert client.delete(url, headers=alice).status_code == 204
    assert client.get(f"{GOALS}/{goal['id']}", headers=alice).json()["contributions_total"] == 0
    assert client.delete(url, headers=alice).status_code == 404


def test_contribution_changes_update_the_goal(client, alice):
    goal = _create(client, alice)

    def updated_at():
        return client.get(f"{GOALS}/{goal['id']}", headers=alice).json()["updated_at"]

    before = updated_at()
    created = _contribute(client, alice, goal["id"]).json()
    after_add = updated_at()
    assert after_add > before

    url = f"{GOALS}/{goal['id']}/contributions/{created['id']}"
    client.put(url, headers=alice, json={"amount": 20_000, "contributed_on": date.today().isoformat()})
    after_edit = updated_at()
    assert after_edit > after_add

    client.delete(url, headers=alice)
    assert updated_at() > after_edit


# ---------------------------------------------------------------------------
# Current funding
# ---------------------------------------------------------------------------


def test_current_funding_is_existing_savings_plus_contributions(client, alice):
    goal = _create(client, alice, existing_savings=300_000)
    _contribute(client, alice, goal["id"], 50_000)
    _contribute(client, alice, goal["id"], 25_000)
    after = client.get(f"{GOALS}/{goal['id']}", headers=alice).json()
    assert after["existing_savings"] == 300_000  # the setup figure is unchanged
    assert after["contributions_total"] == 75_000
    assert after["current_funding"] == 375_000
    assert after["plan"]["funding_counted"] == 375_000
    assert after["plan"]["remaining"] == after["plan"]["future_cost"] - 375_000
    assert after["plan"]["monthly_needed"] < goal["plan"]["monthly_needed"]


def test_fully_funded_goal_needs_nothing_more(client, alice):
    goal = _create(client, alice)
    _contribute(client, alice, goal["id"], goal["plan"]["remaining"])
    after = client.get(f"{GOALS}/{goal['id']}", headers=alice).json()
    assert after["plan"]["remaining"] == 0
    assert after["plan"]["monthly_needed"] == 0
    assert after["affordability"]["status"] == "affordable"
    assert after["affordability"]["schedule"] is None


# ---------------------------------------------------------------------------
# Affordability
# ---------------------------------------------------------------------------


def test_no_income_leaves_affordability_unknown(client, alice):
    affordability = _create(client, alice)["affordability"]
    assert affordability["status"] == "unknown"
    assert affordability["take_home"]["reliability"] == "unavailable"
    assert affordability["breakdown"] is None
    assert affordability["schedule"]["count"] == 6


def test_missing_expenses_leave_affordability_unknown(client, alice):
    _profile(client, alice, take_home=150_000)
    affordability = _create(client, alice)["affordability"]
    assert affordability["status"] == "unknown"
    assert affordability["take_home"]["reliability"] == "confirmed"
    assert any("expenses" in reason for reason in affordability["reasons"])
    assert affordability["breakdown"]["expenses_estimated"] is True


def test_expected_income_alone_is_unknown(client, alice):
    client.put("/api/v1/recommendations/profile", headers=alice, json={"expected_annual_income": 2_400_000})
    _profile(client, alice, expenses=50_000)
    affordability = _create(client, alice)["affordability"]
    assert affordability["status"] == "unknown"
    assert affordability["take_home"]["reliability"] == "expected_only"


def _save_comparison(client, headers, tax_year, income=2_400_000):
    payload = {"tax_year": tax_year, "gross_total_income": income}
    assert client.post("/api/v1/tax/comparison", headers=headers, json=payload).status_code == 200


def test_current_tax_comparison_gives_an_estimated_status(client, alice):
    _save_comparison(client, alice, current_financial_year(date.today())[0])
    _profile(client, alice, expenses=60_000)
    affordability = _create(client, alice)["affordability"]
    assert affordability["status"] != "unknown"
    take_home = affordability["take_home"]
    assert take_home["reliability"] == "estimated"
    assert take_home["source"] == "tax_comparison"
    assert take_home["professional_tax_estimated"] is True
    assert any("likely to be lower" in note for note in affordability["notes"])


def test_last_years_tax_comparison_is_stale(client, alice):
    _save_comparison(client, alice, "2025-26")
    _profile(client, alice, expenses=60_000)
    affordability = _create(client, alice)["affordability"]
    assert affordability["status"] == "unknown"
    assert affordability["take_home"]["reliability"] == "stale"
    assert "FY 2025-26" in affordability["reasons"][0]


def test_confirmed_take_home_is_used_over_estimates(client, alice):
    _save_comparison(client, alice, current_financial_year(date.today())[0], income=5_000_000)
    _profile(client, alice, take_home=90_000, expenses=40_000)
    affordability = _create(client, alice)["affordability"]
    assert affordability["take_home"]["reliability"] == "confirmed"
    assert affordability["take_home"]["monthly"] == 90_000
    assert affordability["breakdown"]["take_home"] == 90_000


@pytest.mark.parametrize(
    ("expenses_in_needs", "expected"),
    # Take-home is 5 needs, so the headroom is half a need. Left after expenses:
    # 5 needs (fits easily), 1.25 (fits, but not comfortably), 0.8 (doesn't fit).
    [(0, "affordable"), (3.75, "tight"), (4.2, "unaffordable")],
)
def test_affordable_tight_and_unaffordable(client, alice, expenses_in_needs, expected):
    need = _create(client, alice)["plan"]["monthly_needed"]
    _profile(client, alice, take_home=5 * need, expenses=int(expenses_in_needs * need))
    goal = client.get(GOALS, headers=alice).json()[0]
    assert goal["affordability"]["status"] == expected
    alternatives = [goal["affordability"][k] for k in ("later_date", "lower_cost")]
    if expected == "affordable":
        assert alternatives == [None, None]
    else:
        assert all(a is not None for a in alternatives)


def test_other_goals_count_as_commitments_but_not_the_goal_itself(client, alice):
    _profile(client, alice, take_home=500_000, expenses=100_000)
    house = _create(client, alice, title="House deposit", goal_type="house", target_date=_months_ahead(60),
                    cost_today=2_000_000, existing_savings=0)
    car = _create(client, alice)
    car_view = client.get(f"{GOALS}/{car['id']}", headers=alice).json()
    house_view = client.get(f"{GOALS}/{house['id']}", headers=alice).json()
    assert car_view["affordability"]["breakdown"]["commitments"] == house_view["plan"]["monthly_needed"]
    assert house_view["affordability"]["breakdown"]["commitments"] == car_view["plan"]["monthly_needed"]


def test_archived_goals_are_not_commitments(client, alice):
    _profile(client, alice, take_home=500_000, expenses=100_000)
    other = _create(client, alice, title="Trip", goal_type="travel")
    client.post(f"{GOALS}/{other['id']}/archive", headers=alice)
    car = _create(client, alice)
    assert car["affordability"]["breakdown"]["commitments"] == 0


def test_a_goal_without_a_plan_leaves_other_goals_unknown(client, alice):
    _profile(client, alice, take_home=500_000, expenses=100_000)
    stuck = _create(client, alice, title="Trip", goal_type="travel")
    with TestSessionLocal() as db:  # its target month arrives
        db.execute(update(Goal).where(Goal.id == stuck["id"]).values(target_date=date.today()))
        db.commit()
    car = _create(client, alice)
    assert car["affordability"]["status"] == "unknown"
    assert any("other goals" in reason for reason in car["affordability"]["reasons"])
    stuck_view = client.get(f"{GOALS}/{stuck['id']}", headers=alice).json()
    assert stuck_view["plan"] is None
    assert "target month has arrived" in stuck_view["plan_issue"]


@pytest.mark.parametrize(("goal_type", "has_loan"), [("car", True), ("house", True), ("travel", False)])
def test_loan_illustrations_only_for_car_and_house(client, alice, goal_type, has_loan):
    _profile(client, alice, take_home=60_000, expenses=40_000)
    affordability = _create(client, alice, goal_type=goal_type)["affordability"]
    assert affordability["status"] == "unaffordable"
    loan = affordability["loan"]
    assert (loan is not None) == has_loan
    if loan:
        assert "not a recommendation" in loan["note"]
        assert loan["annual_rate"] == 0.09


# ---------------------------------------------------------------------------
# Reorder (priority)
# ---------------------------------------------------------------------------


def test_reorder_sets_priority_and_returned_order(client, alice):
    first = _create(client, alice, title="First")
    second = _create(client, alice, title="Second")
    third = _create(client, alice, title="Third")

    response = client.post(f"{GOALS}/reorder", headers=alice, json={"goal_ids": [third["id"], first["id"], second["id"]]})
    assert response.status_code == 200, response.text
    body = response.json()
    assert [g["title"] for g in body] == ["Third", "First", "Second"]
    assert [g["priority"] for g in body] == [0, 1, 2]

    listed = client.get(GOALS, headers=alice).json()
    assert [g["title"] for g in listed] == ["Third", "First", "Second"]


def test_reorder_missing_goal_id_is_rejected(client, alice):
    goal = _create(client, alice)
    response = client.post(f"{GOALS}/reorder", headers=alice, json={"goal_ids": [goal["id"], str(uuid.uuid4())]})
    assert response.status_code == 404


def test_reorder_cannot_touch_another_users_goal(client, alice, bob):
    mine = _create(client, alice)
    theirs = _create(client, bob)
    response = client.post(f"{GOALS}/reorder", headers=alice, json={"goal_ids": [mine["id"], theirs["id"]]})
    assert response.status_code == 404
    # Bob's goal is untouched.
    assert client.get(GOALS, headers=bob).json()[0]["priority"] == 0


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------


def _count_queries(action) -> int:
    statements = []

    def record(conn, cursor, statement, *args):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        action()
    finally:
        event.remove(engine, "before_cursor_execute", record)
    return len(statements)


def test_listing_goals_doesnt_query_once_per_goal(client, alice):
    _profile(client, alice, take_home=500_000, expenses=100_000)
    for _ in range(2):
        goal = _create(client, alice)
        _contribute(client, alice, goal["id"])
    few = _count_queries(lambda: client.get(GOALS, headers=alice))
    for _ in range(4):
        goal = _create(client, alice)
        _contribute(client, alice, goal["id"])
    many = _count_queries(lambda: client.get(GOALS, headers=alice))
    assert many == few
