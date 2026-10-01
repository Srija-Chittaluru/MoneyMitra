"""
Free-form tax Q&A chat, backed by OpenAI.

Unlike explain.py, this can't fall back to a deterministic template — the
question is open-ended. So any failure (missing API key, network error, rate
limit, bad response) degrades to an apologetic reply string instead of an
HTTP error, so the chat UI never has to special-case a broken turn mid
conversation.

Stateless by design: every call resends the full message history (and the
current comparison, if any) to OpenAI. No conversation is stored server-side.
"""

import json
import logging

import openai

from app.core.config import get_settings
from app.modules.tax.context import comparison_context
from app.modules.tax.schemas import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are MoneyMitra's tax assistant for first-time Indian salaried taxpayers. \
You answer three kinds of questions:

1. Questions about their current calculation (if one is given to you as \
JSON below). Every number you state about it must come verbatim from that \
JSON — never compute, round, or guess a number yourself. If no calculation \
is given, say you don't have one to reference yet and answer generally \
instead.
2. General questions about Indian income tax law and the filing process \
(Form 16, 26AS, AIS, old vs. new regime, deduction sections, ITR forms, \
e-verification, etc.) — answer these from your general knowledge.
3. Questions about how the old-vs-new regime comparison works in this app.

Rules that apply to every answer:
- Write in plain, first-principles language for someone with no finance \
background.
- For general tax-law questions, make clear that rates, thresholds, and \
rules change yearly via the Finance Act, and the person should verify \
current figures against official sources (incometax.gov.in, a CA, etc.) \
before filing — don't state old figures as if they're guaranteed current.
- This is general information, not personalized financial or legal advice. \
Never recommend specific funds, products, or investment amounts — if asked, \
say that's outside what this assistant can responsibly answer and suggest a \
qualified advisor or tax professional.
- Keep answers short and focused — a few sentences, not an essay, unless the \
question genuinely needs more.
"""

_FALLBACK_REPLY = "I'm having trouble answering right now — please try again in a moment."

_UNCONFIGURED_REPLY = (
    "The tax assistant isn't set up yet on this server — ask whoever runs this app to "
    "configure it."
)


def _build_messages(payload: ChatRequest) -> list[dict]:
    system_content = _SYSTEM_PROMPT
    if payload.comparison is not None:
        system_content += (
            "\n\nHere is the user's current tax comparison, as JSON:\n"
            f"{json.dumps(comparison_context(payload.comparison))}"
        )

    return [
        {"role": "system", "content": system_content},
        *[{"role": m.role, "content": m.content} for m in payload.messages],
    ]


def generate_reply(payload: ChatRequest) -> ChatResponse:
    settings = get_settings()
    if not settings.openai_api_key:
        return ChatResponse(reply=_UNCONFIGURED_REPLY)

    client = openai.OpenAI(api_key=settings.openai_api_key, timeout=15.0)
    try:
        response = client.chat.completions.create(
            model=settings.openai_model,
            temperature=0.3,
            max_completion_tokens=500,
            messages=_build_messages(payload),
        )
        text = response.choices[0].message.content
        if not text:
            raise ValueError("empty response content")
        return ChatResponse(reply=text)
    except (openai.APIStatusError, openai.APIConnectionError, ValueError, IndexError) as exc:
        logger.warning("Falling back to apologetic chat reply: %s", exc)
        return ChatResponse(reply=_FALLBACK_REPLY)
