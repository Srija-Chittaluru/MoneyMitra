"""The rule set. Each rule looks at the user's Facts and returns zero or more
recommendations; `engine.run` collects them. Recommendations are life-stage
guidance only (see life_stage.py); tax figures live in Tax Comparison, Tax
Planning and ITR Filing.
"""

from collections.abc import Callable

from app.modules.recommendations.basis import SOURCE_BASIS  # noqa: F401  (also used by Tax Planning)
from app.modules.recommendations.facts import Facts
from app.modules.recommendations.life_stage import life_stage
from app.modules.recommendations.schemas import Recommendation

Rule = Callable[[Facts], list[Recommendation]]

RULES: list[Rule] = [life_stage]
