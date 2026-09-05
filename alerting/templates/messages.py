"""Alert message templates, per tier and language.

Two rules govern this file.

**A template is only usable once a native speaker has reviewed it.** A
mistranslated landslide warning is worse than no warning: it can send people
towards the slope. Templates therefore carry a review status, and the dispatcher
refuses to send anything not marked `REVIEWED`. Unreviewed languages fall back
to a reviewed one rather than being guessed at.

**Messages must survive a bad network.** They are written to fit one 160-character
GSM-7 segment where possible, because a multipart SMS during a storm may arrive
in pieces or not at all. Non-Latin scripts are UCS-2 encoded and get 70
characters per segment, which is why the Hindi text is terser than the English.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Review(str, Enum):
    REVIEWED = "reviewed"          # checked by a native speaker; safe to send
    DRAFT = "draft"                # machine or non-native text; must not be sent
    MISSING = "missing"            # no text written yet


@dataclass(frozen=True)
class Template:
    text: str
    review: Review

    @property
    def sendable(self) -> bool:
        return self.review is Review.REVIEWED


# Languages the design calls for. Listed even where no text exists yet, so the
# gap is visible rather than silently absent.
LANGUAGES = ("en", "hi", "as", "kha", "lus", "brx", "njz", "mni")

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "as": "Assamese", "kha": "Khasi",
    "lus": "Mizo", "brx": "Bodo", "njz": "Nyishi", "mni": "Manipuri",
}

# Tier is spelled out in the message. A recipient cannot see a colour on an SMS,
# and "ORANGE" alone means nothing to someone who has not been briefed.
TEMPLATES: dict[tuple[str, str], Template] = {
    ("red", "en"): Template(
        "LANDSLIDE WARNING (RED): high risk at {location} in the next {hours}h. "
        "Avoid this road. Info: {authority}",
        Review.REVIEWED,
    ),
    ("orange", "en"): Template(
        "LANDSLIDE ALERT (ORANGE): raised risk at {location} in the next {hours}h. "
        "Avoid night travel. Info: {authority}",
        Review.REVIEWED,
    ),
    ("yellow", "en"): Template(
        "LANDSLIDE WATCH (YELLOW): {location}, next {hours}h. Drive with care. "
        "Info: {authority}",
        Review.REVIEWED,
    ),
    # Hindi text as supplied in the project's implementation guide. It has not
    # been through native-speaker review in this build, so it is held as DRAFT
    # and will not be dispatched until someone signs it off.
    ("red", "hi"): Template(
        "भूस्खलन चेतावनी: {location} पर अगले {hours} घंटे में उच्च जोखिम। यात्रा से बचें।",
        Review.DRAFT,
    ),
    ("orange", "hi"): Template(
        "भूस्खलन अलर्ट: {location} पर अगले {hours} घंटे में बढ़ा जोखिम। रात में यात्रा न करें।",
        Review.DRAFT,
    ),
}

# Order in which to fall back when a subscriber's language has no sendable text.
FALLBACK_ORDER = ("en",)


def resolve(tier: str, language: str) -> tuple[Template, str]:
    """The template that will actually be sent, and the language it is in.

    Returns the requested language when it is reviewed, otherwise the first
    reviewed fallback. Raises when nothing is sendable at all, because silently
    dropping an alert is the worst outcome available.
    """
    wanted = TEMPLATES.get((tier, language))
    if wanted and wanted.sendable:
        return wanted, language

    for fallback in FALLBACK_ORDER:
        candidate = TEMPLATES.get((tier, fallback))
        if candidate and candidate.sendable:
            return candidate, fallback

    raise LookupError(f"no sendable template for tier {tier!r} in any language")


def render(tier: str, language: str, **variables: object) -> tuple[str, str]:
    """Render the message, returning the text and the language actually used."""
    template, used = resolve(tier, language)
    return template.text.format(**variables), used


def coverage() -> dict[str, dict[str, str]]:
    """Which (tier, language) pairs are ready to send. Used by the readiness check
    so that a gap in a language is a visible fact, not a surprise at dispatch."""
    return {
        language: {
            tier: TEMPLATES.get((tier, language), Template("", Review.MISSING)).review.value
            for tier in ("yellow", "orange", "red")
        }
        for language in LANGUAGES
    }
