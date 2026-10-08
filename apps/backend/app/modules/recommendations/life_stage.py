"""Life-stage guidance: how a person's existing money can work harder.

Each function builds one recommendation for a user's stage of life. It says
what to do, why, how (steps), what the numbers look like (a worked example) and
where the money could go (options described by type; no specific product or
fund is ever recommended). The numbers use the best income figure we have:
their documents, then their declared figures, then their expected income, and
finally a labelled sample income.

All rates are illustrative assumptions kept in `wealth.py`.
"""

from collections.abc import Callable
from dataclasses import dataclass

from app.modules.recommendations import wealth
from app.modules.recommendations.basis import SOURCE_BASIS
from app.modules.recommendations.facts import Facts
from app.modules.recommendations.money import format_inr as inr
from app.modules.recommendations.profile import EmployeeCategory
from app.modules.recommendations.schemas import Illustration, IllustrationLine, Option, Recommendation
from app.modules.recommendations.stages import LifeStage

# Savings-balance estimates from AIS interest are only worth showing above this.
MIN_IDLE_AMOUNT = 25_000


@dataclass(frozen=True)
class Income:
    monthly: int
    level: int
    basis: str
    is_example: bool


def income_of(facts: Facts) -> Income:
    docs = facts.documents
    if docs.usable and docs.draft is not None and docs.draft.salary.salary_17_1 > 0:
        return Income(docs.draft.salary.salary_17_1 // 12, 3, f"From your {docs.source_text}", False)
    if facts.declared is not None:
        return Income(facts.declared.annual_income // 12, 2, SOURCE_BASIS[facts.declared.source], False)
    if facts.expected_income:
        return Income(facts.expected_income // 12, 1, "Based on your expected income", False)
    return Income(wealth.SAMPLE_MONTHLY_INCOME, 1, "Based on your age (example figures)", True)


def _line(label: str, value: str, emphasis: bool = False) -> IllustrationLine:
    return IllustrationLine(label=label, value=value, emphasis=emphasis)


def _illustration(title: str, lines: list[IllustrationLine], income: Income, uses_income: bool = True) -> Illustration:
    note = wealth.RATE_NOTE
    example = income.is_example and uses_income
    if example:
        note = (
            f"These use an example income of {inr(income.monthly)} a month. Add your income to see your own numbers. "
            + note
        )
    return Illustration(title=title, lines=lines, note=note, is_example=example or not uses_income)


def _pct(share: float) -> int:
    return round(share * 100)


def _monthly_saving(income: Income) -> int:
    return max(500, wealth.round_to(income.monthly * wealth.SAVINGS_SHARE, 500))


def _monthly_expenses(income: Income) -> int:
    return wealth.round_to(income.monthly * wealth.EXPENSE_SHARE, 100)


def _emergency_months(facts: Facts) -> int:
    # Government and PSU jobs are usually stable, so a smaller cushion is a common target.
    return 4 if facts.employee_category in (EmployeeCategory.GOVERNMENT, EmployeeCategory.PSU) else 6


def _emergency_target(facts: Facts, income: Income) -> int:
    return wealth.round_to(_monthly_expenses(income) * _emergency_months(facts), 1_000)


def _equity_share(age: int, floor: int, ceiling: int) -> int:
    """The 'hundred minus your age' rule of thumb for how much to hold in growth investments."""
    return max(floor, min(ceiling, 100 - age))


def _rec(facts: Facts, income: Income, **fields) -> Recommendation:
    return Recommendation(level=income.level, basis=income.basis, **fields)


def _general(rec_id: str, **fields) -> Recommendation:
    """Advice that doesn't depend on the user's figures."""
    return Recommendation(id=rec_id, level=1, basis="Based on your age", **fields)


# ---------------------------------------------------------------------------
# Every stage
# ---------------------------------------------------------------------------


def idle_money(facts: Facts, income: Income) -> Recommendation:
    """Savings sitting in a low-interest account. With an AIS, estimate how much."""
    docs = facts.documents
    steps = [
        "List what you hold in every savings account and in cash.",
        "Keep your emergency fund (3 to 6 months of spending) where you can reach it in a day.",
        "Money you'll need within 3 years belongs in a fixed deposit or liquid fund; money for 3 to 5 years in "
        "safer debt funds or deposits; money you won't touch for 5 years or more can go into long-term "
        "investments.",
        "You don't have to move it all at once. Moving a part each month smooths out the timing.",
        "Interest on fixed deposits is taxed at your slab rate, so compare returns after tax.",
    ]
    options = [
        Option(name="Fixed deposit", summary="A fixed rate for a fixed period; breaking it early usually costs a "
               "penalty.", risk="low", suits="Money you need in 1 to 5 years"),
        Option(name="Liquid or short-term debt fund", summary="Invests in very short-term loans; usually pays out in "
               "about a day. Returns can dip slightly but rarely fall.", risk="low", suits="Money you may need soon"),
        Option(name="PPF", summary="Government-backed, tax-free interest, 15-year lock-in with partial withdrawals "
               "from year 7.", risk="low", suits="Long-term safe savings"),
        Option(name="Equity mutual fund SIP", summary="Market-linked: can rise well over many years and fall "
               "sharply in a single year.", risk="high", suits="Money you won't need for 5+ years"),
    ]

    if "ais" in docs.categories and docs.draft is not None:
        other = docs.draft.other_income
        interest = other.savings_interest
        if interest > 0:
            balance = wealth.round_to(interest / wealth.SAVINGS_ACCOUNT_RATE, 1_000)
            target = _emergency_target(facts, income)
            excess = wealth.round_to(max(0, balance - target), 1_000)
            extra = wealth.yearly_earnings(excess, wealth.SAFE_RATE - wealth.SAVINGS_ACCOUNT_RATE)
            lines = [
                _line("Savings-account interest in your AIS", inr(interest)),
                _line(f"Savings balance this suggests (at {wealth.SAVINGS_ACCOUNT_RATE:.0%})", inr(balance)),
                _line("Emergency fund to keep aside", inr(target)),
            ]
            if other.deposit_interest > 0:
                held = wealth.round_to(other.deposit_interest / wealth.SAFE_RATE, 1_000)
                lines.append(_line("Deposits you already hold (from deposit interest)", f"about {inr(held)}"))
            note = ("This is an estimate: it assumes your savings earn about "
                    f"{wealth.SAVINGS_ACCOUNT_RATE:.0%}, so check your real balances. " + wealth.RATE_NOTE)
            if excess >= MIN_IDLE_AMOUNT:
                lines += [
                    _line("Money above your emergency fund", inr(excess)),
                    _line(f"Extra it could earn a year at {wealth.SAFE_RATE:.1%} instead of "
                          f"{wealth.SAVINGS_ACCOUNT_RATE:.0%}", inr(extra), emphasis=True),
                ]
                return Recommendation(
                    id="idle_money", level=3, basis="From your AIS",
                    title=f"About {inr(excess)} of your savings may be sitting idle",
                    description=(f"Your AIS shows {inr(interest)} of savings-account interest, which suggests around "
                                 f"{inr(balance)} in savings accounts. After setting aside about {inr(target)} as an "
                                 f"emergency fund, roughly {inr(excess)} could earn about {inr(extra)} more a year in a "
                                 "fixed deposit or liquid fund."),
                    reason="A savings account pays less than prices rise, so money left there loses buying power "
                           "every year. Putting the part you don't need soon to work is the simplest way to make "
                           "your existing money earn more.",
                    steps=steps, options=options,
                    illustration=Illustration(title="Your savings, from your AIS", lines=lines, note=note,
                                              is_example=False),
                )
            return Recommendation(
                id="idle_money", level=3, basis="From your AIS",
                title="Your savings balance looks about right",
                description=(f"Your AIS shows {inr(interest)} of savings-account interest, which suggests around "
                             f"{inr(balance)} in savings accounts, close to the {inr(target)} an emergency fund "
                             "needs. Any new savings beyond that is what should go to work."),
                reason="Keeping an emergency fund in a savings account is fine. It's the money above it that should "
                       "earn more.",
                steps=steps, options=options,
                illustration=Illustration(title="Your savings, from your AIS", lines=lines, note=note,
                                          is_example=False),
            )

    saved = 100_000
    shrunk = wealth.round_to(saved / (1 + wealth.INFLATION) ** 10, 1_000)
    return _general(
        "idle_money",
        title="Don't leave idle money in a savings account",
        description=("Money above your emergency fund earns about "
                     f"{wealth.SAVINGS_ACCOUNT_RATE:.0%} in a savings account while everyday prices rise about "
                     f"{wealth.INFLATION:.0%} a year, so it quietly loses value. Moving it to a fixed deposit or "
                     "liquid fund, or to long-term investments if you won't need it for years, makes it work for you."),
        reason="This is the simplest way to earn more from money you already have, with no extra effort or risk "
               "if you stay in safe options.",
        steps=steps, options=options,
        illustration=_illustration(
            f"What {inr(saved)} does over time",
            [
                _line("In a savings account for a year", inr(wealth.yearly_earnings(saved, wealth.SAVINGS_ACCOUNT_RATE))),
                _line("In a fixed deposit or liquid fund for a year", inr(wealth.yearly_earnings(saved, wealth.SAFE_RATE))),
                _line(f"What {inr(saved)} will buy in 10 years, in today's money", inr(shrunk), emphasis=True),
            ],
            income, uses_income=False,
        ),
    )


# ---------------------------------------------------------------------------
# Career Start
# ---------------------------------------------------------------------------


def emergency_fund(facts: Facts, income: Income) -> Recommendation:
    months = _emergency_months(facts)
    expenses = _monthly_expenses(income)
    target = _emergency_target(facts, income)
    in_savings = wealth.yearly_earnings(target, wealth.SAVINGS_ACCOUNT_RATE)
    in_safe = wealth.yearly_earnings(target, wealth.SAFE_RATE)

    note = ""
    if months == 4:
        note = " Government and PSU jobs are usually stable, so 4 months is a common target; private jobs call for 6."
    elif facts.employee_category == EmployeeCategory.PRIVATE:
        note = " In the private sector, 6 months is a common target."

    return _rec(
        facts, income, id="emergency_fund",
        title="Build an emergency fund, and keep it earning",
        description=(f"Set aside about {months} months of expenses, roughly {inr(target)} (assuming you spend around "
                     f"{_pct(wealth.EXPENSE_SHARE)}% of your {inr(income.monthly)} monthly income). Where you keep "
                     f"it matters: the same money earns about {inr(in_safe - in_savings)} more a year in a fixed "
                     "deposit or liquid fund than in a savings account."),
        reason=("An emergency fund stops a job loss, illness or big repair from forcing you to sell investments at "
                "a bad time or borrow at high interest. It's for safety, so it belongs in low-risk places." + note),
        steps=[
            "Add up what you really spend in a month on essentials: rent, food, bills, EMIs and insurance.",
            f"Multiply by {months}. The figure above assumes spending of about {inr(expenses)} a month, so replace "
            "it with your own.",
            "Move a fixed amount into it on salary day until you reach the target.",
            "Keep it in a savings account with auto-sweep, a fixed deposit or a liquid fund: never in shares, and "
            "never anywhere you can't withdraw from within a day or two.",
            "Spend from it only for real emergencies, then top it up again.",
        ],
        illustration=_illustration(
            f"What {inr(target)} earns in a year",
            [
                _line(f"In a savings account (about {wealth.SAVINGS_ACCOUNT_RATE:.0%})", inr(in_savings)),
                _line(f"In a fixed deposit or liquid fund (about {wealth.SAFE_RATE:.1%})", inr(in_safe)),
                _line("Extra you earn from the same money", inr(in_safe - in_savings), emphasis=True),
            ],
            income,
        ),
        options=[
            Option(name="Savings account", summary="Instant access, lowest return.", risk="low",
                   suits="The first month or so of expenses"),
            Option(name="Sweep-in fixed deposit", summary="A savings account that automatically moves extra balance "
                   "into a deposit and back when you need it.", risk="low", suits="The core of your fund"),
            Option(name="Liquid mutual fund", summary="Invests in very short-term loans; usually pays out in about a "
                   "day; returns can dip slightly.", risk="low", suits="Part of your fund, for a bit more return"),
            Option(name="Short fixed deposit", summary="Pays a fixed rate; breaking it early usually costs a "
                   "penalty.", risk="low", suits="A portion you're unlikely to need quickly"),
        ],
    )


def start_investing(facts: Facts, income: Income) -> Recommendation:
    monthly = _monthly_saving(income)
    horizons = (10, 20, 30)
    lines = [
        _line(f"{inr(monthly)} a month for {y} years", f"{inr(wealth.sip_value(monthly, wealth.GROWTH_RATE, y))} "
              f"(you put in {inr(monthly * 12 * y)})")
        for y in horizons
    ]
    at_30 = wealth.sip_value(monthly, wealth.GROWTH_RATE, 30)
    in_savings = wealth.sip_value(monthly, wealth.SAVINGS_ACCOUNT_RATE, 30)
    lines.append(_line(f"The same {inr(monthly)} a month for 30 years in a savings account", inr(in_savings),
                       emphasis=True))

    return _rec(
        facts, income, id="start_investing",
        title="Start investing every month, even a small amount",
        description=(f"Investing about {inr(monthly)} a month (around {_pct(wealth.SAVINGS_SHARE)}% of your income) "
                     f"for 30 years could grow to roughly {inr(at_30)} at an illustrative {wealth.GROWTH_RATE:.0%} a "
                     f"year, against about {inr(in_savings)} if the same money sat in a savings account. Time does "
                     "most of the work, so starting early matters more than starting big."),
        reason=("At your age the biggest advantage you have is time. Money invested early compounds for decades, so "
                "every year you wait costs far more than the money you'd have put in."),
        steps=[
            "Decide an amount you won't miss, even if it's small, and start with it.",
            "Automate it: set a standing instruction (an SIP) for the day after your salary arrives.",
            "Raise it by about 10% each year, or whenever your pay goes up.",
            "Keep it invested for at least 5 years; don't react to market falls, which are normal.",
            "Use regulated platforms only, and check your investments once a year, not every day.",
        ],
        illustration=_illustration(f"What {inr(monthly)} a month can grow to", lines, income),
        options=[
            Option(name="Equity mutual fund SIP", summary="Market-linked: can rise well over many years and fall "
                   "sharply in a single year. No lock-in.", risk="high", suits="Goals 5 or more years away"),
            Option(name="PPF", summary="Government-backed, tax-free interest, 15-year lock-in with partial "
                   "withdrawals from year 7.", risk="low", suits="Safe long-term savings"),
            Option(name="EPF / VPF", summary="Retirement savings through your employer; VPF lets you add more.",
                   risk="low", suits="Retirement, alongside other investments"),
            Option(name="Recurring deposit", summary="A fixed monthly deposit at a fixed rate.", risk="low",
                   suits="Goals under 3 years away"),
        ],
    )


def protect_income(facts: Facts, income: Income) -> Recommendation:
    saving = _monthly_saving(income)
    bill = 500_000
    months = -(-bill // saving)
    declared = facts.declared
    if declared is not None and declared.claims_health_self:
        description = ("You already pay for health insurance. Check that the cover is large enough (₹5 lakh or more "
                       "is a common minimum) and isn't only your employer's policy, which ends when you leave.")
    elif declared is not None:
        description = ("We found no health insurance premium in your figures. A hospital stay can undo years of "
                       "saving, and a policy costs least when you're young and healthy.")
    else:
        description = ("Health insurance bought now is cheap and avoids waiting periods later. If anyone depends on "
                       "your income, term life insurance protects them too.")

    return _rec(
        facts, income, id="protect_income",
        title="Protect your income before you grow it",
        description=description,
        reason="One large medical bill can wipe out years of savings, so insurance protects everything else you "
               "build. It's far cheaper while you're young.",
        steps=[
            "Buy your own health policy, even if your employer gives you cover: that cover ends when you leave.",
            "Choose a sum insured of at least ₹5 to 10 lakh, and compare claim-settlement records and hospital "
            "networks.",
            "If anyone depends on your income, add a pure term life policy worth 10 to 15 times your yearly income. "
            "Avoid plans that mix insurance with investing.",
            "Disclose your health history honestly, or claims can be rejected.",
            "Set the premium to renew automatically so cover never lapses.",
        ],
        illustration=_illustration(
            "What one hospital bill can do",
            [
                _line("A hospital bill", inr(bill)),
                _line(f"What you could save each month (about {_pct(wealth.SAVINGS_SHARE)}% of income)", inr(saving)),
                _line("Months of saving it would wipe out", f"about {months} months", emphasis=True),
            ],
            income,
        ),
        options=[
            Option(name="Individual health policy", summary="Cover for you alone, in your own name.", risk="low",
                   suits="Single people"),
            Option(name="Family floater", summary="One sum insured shared across the family.", risk="low",
                   suits="You, a spouse and children"),
            Option(name="Term life insurance", summary="Pays your family a lump sum if you die within the term; no "
                   "payout otherwise, which is why it's cheap.", risk="low", suits="Anyone who depends on your income"),
            Option(name="Employer group cover", summary="Useful, but it ends when you change jobs.", risk="low",
                   suits="A top-up, never your only cover"),
        ],
    )


def costly_debt(facts: Facts, income: Income) -> Recommendation:
    owed = 50_000
    return _general(
        "costly_debt",
        title="Pay off expensive debt before you invest",
        description=("Credit card interest of 36% to 42% a year is a certain cost far larger than any investment's "
                     "likely gain. Clearing it is the best 'return' you can get on your money."),
        reason="Every rupee used to clear 40% debt saves you 40%, with no risk. No safe investment pays anywhere "
               "near that.",
        steps=[
            "List every loan and card balance with its interest rate.",
            "Pay the minimum on all of them, and put every spare rupee on the one with the highest rate.",
            "Don't roll over a card balance. Pay it in full each month.",
            "Keep a small emergency buffer so a surprise bill doesn't go back on the card.",
            "Once the costly debt is gone, send the same monthly amount into your investments.",
        ],
        illustration=_illustration(
            f"What {inr(owed)} costs if left on a card for a year",
            [
                _line("At 36% a year", inr(wealth.yearly_earnings(owed, 0.36))),
                _line("At 42% a year", inr(wealth.yearly_earnings(owed, 0.42))),
                _line(f"What the same {inr(owed)} might earn in a fixed deposit", inr(
                    wealth.yearly_earnings(owed, wealth.SAFE_RATE)), emphasis=True),
            ],
            income, uses_income=False,
        ),
    )


# ---------------------------------------------------------------------------
# Mid-Career
# ---------------------------------------------------------------------------


def retirement_number(facts: Facts, income: Income) -> Recommendation:
    age = facts.age or 40
    years = max(1, wealth.RETIREMENT_AGE - age)
    today = _monthly_expenses(income)
    at_retirement = wealth.round_to(today * (1 + wealth.INFLATION) ** years, 1_000)
    pot = wealth.round_to(at_retirement * 12 * wealth.CORPUS_MULTIPLE, 100_000)
    saving = _monthly_saving(income)
    reachable = wealth.round_to(wealth.sip_value(saving, wealth.GROWTH_RATE, years), 100_000)
    needed = wealth.round_to(wealth.monthly_needed(pot, wealth.GROWTH_RATE, years), 500)

    verdict = (
        f"Saving about {_pct(wealth.SAVINGS_SHARE)}% of your income ({inr(saving)} a month) would be enough on these "
        "assumptions."
        if reachable >= pot
        else f"Saving {_pct(wealth.SAVINGS_SHARE)}% of your income ({inr(saving)} a month) would reach about "
             f"{inr(reachable)}, so start now and raise the amount each year to close the gap."
    )
    return _rec(
        facts, income, id="retirement_number",
        title="Work out your retirement number, then close the gap",
        description=(f"To keep today's lifestyle at {wealth.RETIREMENT_AGE} you'd need a retirement pot of roughly "
                     f"{inr(pot)}. Investing about {inr(needed)} a month for the next {years} years at an "
                     f"illustrative {wealth.GROWTH_RATE:.0%} would get you there. {verdict}"),
        reason=("Retirement is the one goal you can't borrow for. Prices keep rising, so the pot you need is much "
                "bigger than today's spending suggests, and the sooner you close the gap, the less you have to put "
                "in each month."),
        steps=[
            "Replace the spending assumption with your real monthly spending.",
            "Decide the age you want to stop working: later retirement shrinks the pot you need.",
            "Direct money to retirement accounts first (EPF, NPS), then add equity SIPs for growth.",
            "Raise your monthly amount by about 10% every year, or at every pay rise.",
            "Don't cash out EPF or NPS when you change jobs. Transfer it instead.",
        ],
        illustration=_illustration(
            "Your retirement number",
            [
                _line(f"Monthly spending today (about {_pct(wealth.EXPENSE_SHARE)}% of income)", inr(today)),
                _line(f"The same life at {wealth.RETIREMENT_AGE}, after {wealth.INFLATION:.0%} yearly price rises",
                      inr(at_retirement)),
                _line(f"Pot needed ({wealth.CORPUS_MULTIPLE} times a year's spending)", inr(pot)),
                _line(f"{inr(saving)} a month for {years} years could reach", inr(reachable)),
                _line("Monthly amount needed to reach the pot", inr(needed), emphasis=True),
            ],
            income,
        ),
        options=[
            Option(name="NPS", summary="A government-regulated pension account where you choose the mix of equity "
                   "and debt. Locked until retirement, and part of it must buy a pension.", risk="medium",
                   suits="Disciplined, long-term retirement saving"),
            Option(name="EPF / VPF", summary="Retirement savings through your employer, at a government-set rate.",
                   risk="low", suits="The safe core of your retirement money"),
            Option(name="Equity mutual fund SIP", summary="Market-linked growth; can fall sharply in a year.",
                   risk="high", suits="The growth part of your retirement money"),
            Option(name="PPF", summary="Government-backed, tax-free interest, 15-year lock-in.", risk="low",
                   suits="Extra safe savings"),
        ],
    )


def asset_mix(facts: Facts, income: Income) -> Recommendation:
    age = facts.age or 40
    equity = _equity_share(age, 30, 80)
    safe = 100 - equity
    monthly = _monthly_saving(income)
    equity_part = wealth.round_to(monthly * equity / 100, 100)

    extra = ""
    docs = facts.documents
    if "ais" in docs.categories and docs.draft is not None and docs.draft.other_income.dividends.total > 0:
        extra = " Your AIS shows dividend income, so you already hold shares or funds; count them when you check."

    return _rec(
        facts, income, id="asset_mix",
        title="Check that your money is split sensibly between growth and safety",
        description=(f"A common rule of thumb is to keep about {equity}% in growth investments (equity) and {safe}% "
                     f"in safer ones (deposits, PPF/EPF, debt funds) at {age}. Of {inr(monthly)} a month, that's about "
                     f"{inr(equity_part)} for growth and {inr(monthly - equity_part)} for safety.{extra}"),
        reason=("Too little growth and inflation eats your savings; too much and a market fall can hurt just when you "
                "need the money. A sensible split lets you take enough risk without losing sleep."),
        steps=[
            "List everything you own: bank deposits, EPF/PPF, mutual funds, shares, gold and property.",
            "Add up how much is in growth investments and how much in safe ones.",
            "Compare with the split above. It's a starting point; adjust for your own comfort with risk.",
            "Fix any gap by directing new money to the side that's short, instead of selling.",
            "Review once a year, and don't chase whatever did best last year.",
        ],
        illustration=_illustration(
            f"A split for {inr(monthly)} a month",
            [
                _line(f"Rule of thumb at {age}", f"{equity}% growth, {safe}% safety"),
                _line("Growth investments (equity funds)", inr(equity_part)),
                _line("Safer investments (deposits, PPF/EPF, debt funds)", inr(monthly - equity_part), emphasis=True),
            ],
            income,
        ),
        options=[
            Option(name="Equity or index funds", summary="Growth over the long run, with sharp ups and downs.",
                   risk="high", suits="Money you won't need for 5+ years"),
            Option(name="PPF, EPF, deposits, debt funds", summary="Steady, lower returns; debt funds can dip "
                   "slightly.", risk="low", suits="The stable part of your money"),
            Option(name="Gold", summary="Can protect against rising prices, but pays no income and its price "
                   "swings.", risk="medium", suits="A small slice, around 5 to 10%"),
        ],
    )


def family_cover(facts: Facts, income: Income) -> Recommendation:
    yearly = income.monthly * 12
    low, high = wealth.round_to(yearly * 10, 100_000), wealth.round_to(yearly * 15, 100_000)
    parents = ""
    declared = facts.declared
    if declared is not None and declared.claims_health_parents is False:
        parents = " Your figures show no premium for your parents' health cover."

    return _rec(
        facts, income, id="family_cover",
        title="Make sure the people who depend on you are covered",
        description=(f"If others depend on your income, a pure term life policy worth 10 to 15 times your yearly income "
                     f"(about {inr(low)} to {inr(high)} for you) replaces it for them at a low premium. Add health "
                     f"cover for your family and, if you support them, your parents.{parents}"),
        reason=("Your responsibilities peak in these years: a home loan, children, parents. Insurance is what keeps "
                "your investments intact if something goes wrong."),
        steps=[
            "Add up your loans and the years of income your family would need, and size term cover to match.",
            "Buy pure term insurance. Avoid plans that mix insurance with investing, which cost more and do both "
            "jobs poorly.",
            "Check your family's health cover is at least ₹10 lakh, using a floater plus a cheap top-up if needed.",
            "If you support your parents, buy them a separate policy: it's cheaper while they're healthier.",
            "Review the cover after every major life change: marriage, a child, a bigger loan.",
        ],
        illustration=_illustration(
            "How much term cover to consider",
            [
                _line("Your yearly income", inr(yearly)),
                _line("Term cover at 10 to 15 times", f"{inr(low)} to {inr(high)}", emphasis=True),
            ],
            income,
        ),
        options=[
            Option(name="Term life insurance", summary="Pays your family a lump sum if you die within the term.",
                   risk="low", suits="Anyone with dependants or loans"),
            Option(name="Family health floater", summary="One sum insured shared across the family.", risk="low",
                   suits="You, a spouse and children"),
            Option(name="Super top-up health cover", summary="Cheap extra cover that applies after a deductible.",
                   risk="low", suits="Raising cover without a big premium"),
            Option(name="Parents' health policy", summary="A separate policy for your parents, with its own sum "
                   "insured.", risk="low", suits="If you support your parents"),
        ],
    )


def goal_investing(facts: Facts, income: Income) -> Recommendation:
    goal, years = 1_000_000, 10
    growth = wealth.monthly_needed(goal, wealth.GROWTH_RATE, years)
    safe = wealth.monthly_needed(goal, wealth.SAFE_RATE, years)
    bank = wealth.monthly_needed(goal, wealth.SAVINGS_ACCOUNT_RATE, years)
    return _general(
        "goal_investing",
        title="Give each big goal its own money and its own timeline",
        description=(f"For a goal like a child's education or a home down payment, match where the money sits to when "
                     f"you need it. As an example, {inr(goal)} in {years} years takes about {inr(growth)} a month in "
                     f"growth investments, {inr(safe)} in safer deposits, or {inr(bank)} in a savings account."),
        reason=("Money for a goal 10 years away can take some risk; money for a goal 2 years away can't. Giving each "
                "goal its own timeline stops you cashing in long-term savings at the wrong moment."),
        steps=[
            "Write down each goal, what it will cost, and the year you'll need the money.",
            "Allow for costs rising: education and healthcare usually get dearer faster than everyday prices.",
            "Work out the monthly amount for each goal and invest it separately, so you can see progress.",
            "More than 5 years away: growth investments. 3 to 5 years: a mix. Under 3 years: deposits or debt funds.",
            "As the date comes within 2 to 3 years, move the money to safer options so a market fall can't derail it.",
        ],
        illustration=_illustration(
            f"Saving {inr(goal)} in {years} years",
            [
                _line(f"In growth investments (about {wealth.GROWTH_RATE:.0%})", f"{inr(growth)} a month"),
                _line(f"In fixed deposits or debt funds (about {wealth.SAFE_RATE:.1%})", f"{inr(safe)} a month"),
                _line(f"In a savings account (about {wealth.SAVINGS_ACCOUNT_RATE:.0%})", f"{inr(bank)} a month",
                      emphasis=True),
            ],
            income, uses_income=False,
        ),
        options=[
            Option(name="Equity mutual fund SIP", summary="Growth over the long run, with sharp ups and downs.",
                   risk="high", suits="Goals more than 5 years away"),
            Option(name="Hybrid or balanced fund", summary="A mix of equity and debt in one fund.", risk="medium",
                   suits="Goals 3 to 5 years away"),
            Option(name="Fixed or recurring deposit", summary="A fixed return for a fixed period.", risk="low",
                   suits="Goals under 3 years away"),
        ],
    )


# ---------------------------------------------------------------------------
# Pre-Retirement
# ---------------------------------------------------------------------------


def preserve_capital(facts: Facts, income: Income) -> Recommendation:
    age = facts.age or 55
    equity = _equity_share(age, 20, 60)
    safe = 100 - equity
    per = 1_000_000
    return _rec(
        facts, income, id="preserve_capital",
        title="Shift gradually from growth to safety",
        description=(f"With retirement close, a market fall hurts more because there's less time to recover. A common "
                     f"rule of thumb is about {equity}% in growth investments and {safe}% in safer ones at {age}: for "
                     f"every {inr(per)} you hold, {inr(per * equity // 100)} in equity and {inr(per * safe // 100)} in "
                     "safer options. Shift a little each year instead of all at once."),
        reason=("A big loss just before you start drawing on your savings is the hardest to recover from. Moving "
                "towards safety gradually protects what you've built while keeping some growth for the long "
                "retirement ahead."),
        steps=[
            "Work out your current split between equity and safer investments.",
            "Reduce equity gradually, by about 3 to 5 percentage points a year, using maturing deposits and new "
            "money rather than selling in a hurry.",
            "Keep 2 to 3 years of spending in safe, easy-to-reach places, so you never have to sell shares in a crash.",
            "Don't go entirely to safe options: retirement can last 25 to 30 years and prices keep rising.",
            "Rebalance once a year.",
        ],
        illustration=_illustration(
            f"For every {inr(per)} you hold",
            [
                _line(f"Growth investments ({equity}%)", inr(per * equity // 100)),
                _line(f"Safer investments ({safe}%)", inr(per * safe // 100), emphasis=True),
            ],
            income, uses_income=False,
        ),
        options=[
            Option(name="Debt funds and fixed deposits", summary="Steady, lower returns; debt funds can dip "
                   "slightly.", risk="low", suits="The next few years of spending"),
            Option(name="Senior Citizens' Savings Scheme", summary="Government-backed, for people aged 60 and above, "
                   "with a fixed rate and a 5-year term.", risk="low", suits="Safe income once you turn 60"),
            Option(name="PPF / EPF", summary="Government-backed and tax-friendly.", risk="low",
                   suits="Long-term safe savings"),
            Option(name="Equity or index funds", summary="Keep a part for growth against rising prices.",
                   risk="high", suits="Money you won't touch for 7+ years"),
        ],
    )


def retirement_income(facts: Facts, income: Income) -> Recommendation:
    age = facts.age or 55
    years = max(0, wealth.RETIREMENT_AGE - age)
    today = _monthly_expenses(income)
    at_retirement = wealth.round_to(today * (1 + wealth.INFLATION) ** years, 1_000)
    pot = wealth.round_to(at_retirement * 12 * wealth.CORPUS_MULTIPLE, 100_000)
    lines = [
        _line(f"Monthly spending today (about {_pct(wealth.EXPENSE_SHARE)}% of income)", inr(today)),
        _line(f"The same life at {wealth.RETIREMENT_AGE}, after {wealth.INFLATION:.0%} yearly price rises",
              inr(at_retirement)),
        _line(f"Pot needed ({wealth.CORPUS_MULTIPLE} times a year's spending)", inr(pot)),
    ]
    if years > 0:
        needed = wealth.round_to(wealth.monthly_needed(pot, wealth.SAFE_RATE, years), 500)
        lines.append(_line(f"Monthly saving needed over {years} years at about {wealth.SAFE_RATE:.1%}", inr(needed),
                           emphasis=True))
    return _rec(
        facts, income, id="retirement_income",
        title="Plan the monthly income that will replace your salary",
        description=(f"Once your salary stops, your savings must pay you. To keep today's lifestyle, a pot of roughly "
                     f"{inr(pot)} could pay for it if you draw about 4% a year. Work out what you already have and how "
                     "the gap, if any, can be closed."),
        reason=("The biggest worry in retirement is outliving your money. A plan that turns savings into a steady "
                "monthly income, and keeps pace with rising prices, removes that worry."),
        steps=[
            "Total what you already have: EPF, PPF, NPS, deposits, mutual funds and any rental income.",
            "Estimate your real retirement spending, including healthcare, which tends to rise.",
            "Split your savings into buckets: the next 2 to 3 years of spending in safe, easy-to-reach places, the "
            "next 5 to 7 in debt investments, and the rest in growth investments.",
            "Plan how you'll draw income: regular withdrawals from debt or hybrid funds, a pension from an annuity, "
            "and interest from deposits or the Senior Citizens' Savings Scheme.",
            "Start by drawing about 4% of your pot a year, and adjust for how your investments perform.",
        ],
        illustration=_illustration("The pot your retirement needs", lines, income),
        options=[
            Option(name="Systematic withdrawal from debt or hybrid funds", summary="Regular payouts from a fund, "
                   "with the rest still invested.", risk="medium", suits="Flexible monthly income"),
            Option(name="Annuity (including from NPS)", summary="Converts a lump sum into a pension for life.",
                   risk="low", suits="A guaranteed base income"),
            Option(name="Senior Citizens' Savings Scheme", summary="Government-backed quarterly interest for people "
                   "aged 60 and above.", risk="low", suits="Safe, regular income"),
            Option(name="Fixed deposit ladder", summary="Deposits maturing in different years, so money is "
                   "available steadily.", risk="low", suits="Predictable income and access"),
        ],
    )


def retirement_health(facts: Facts, income: Income) -> Recommendation:
    declared = facts.declared
    note = (" We found no health insurance premium in your figures."
            if declared is not None and not declared.claims_health_self else "")
    return _general(
        "retirement_health",
        title="Lock in health cover before you retire",
        description=("Employer health cover usually ends when you retire, and premiums and waiting periods get worse "
                     f"with age. A personal policy bought now avoids both.{note}"),
        reason=("Medical costs rise sharply in later life and can drain a retirement fund quickly. Cover that you "
                "hold in your own name continues after your job ends."),
        steps=[
            "Find out exactly what cover you'd lose when you retire.",
            "Buy or increase a personal or family health policy before you turn 60, while it's cheaper and easier "
            "to get.",
            "Aim for a sum insured of at least ₹10 lakh, with a cheap top-up for large bills.",
            "Disclose your health conditions honestly, and understand waiting periods for existing ones.",
            "If you already have cover, check whether you can port it to a better plan without losing benefits.",
        ],
        options=[
            Option(name="Personal or family health policy", summary="Cover in your own name that continues after "
                   "retirement.", risk="low", suits="Everyone before retiring"),
            Option(name="Super top-up cover", summary="Cheap extra cover that applies after a deductible.",
                   risk="low", suits="Raising cover without a big premium"),
            Option(name="Senior citizen policy", summary="Plans designed for people over 60, usually with higher "
                   "premiums and some waiting periods.", risk="low", suits="Once you turn 60"),
        ],
    )


def nominations(facts: Facts, income: Income) -> Recommendation:
    return _general(
        "nominations",
        title="Make sure your money reaches the right people",
        description=("Without nominations and a will, your family can face months of paperwork to claim your savings. "
                     "A short afternoon of admin now avoids that."),
        reason="Everything you've built only helps your family if they can actually get to it.",
        steps=[
            "Add a nominee to every bank account, fixed deposit, demat account, mutual fund, EPF, NPS and insurance "
            "policy.",
            "Write a simple will, and have it witnessed, so your wishes are clear.",
            "Keep a list of all your accounts, policies and where the documents are.",
            "Tell a trusted person where that list is.",
            "Review all of this after any big life change.",
        ],
    )


# ---------------------------------------------------------------------------
# Which advice each stage gets, in the order it is shown
# ---------------------------------------------------------------------------

Builder = Callable[[Facts, Income], Recommendation]

BUILDERS: dict[LifeStage, tuple[Builder, ...]] = {
    LifeStage.CAREER_START: (emergency_fund, idle_money, start_investing, protect_income, costly_debt),
    LifeStage.MID_CAREER: (idle_money, retirement_number, asset_mix, family_cover, goal_investing),
    LifeStage.PRE_RETIREMENT: (preserve_capital, retirement_income, idle_money, retirement_health, nominations),
}


def life_stage(facts: Facts) -> list[Recommendation]:
    if facts.stage is None:
        return []
    income = income_of(facts)
    return [build(facts, income) for build in BUILDERS[facts.stage]]
