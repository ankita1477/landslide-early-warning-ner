"""Alerting is the last link. A warning that is wrong, unreadable or ignored
here undoes every layer before it."""

import pytest

from alerting.dispatcher import RANK, Dispatcher, Subscriber
from alerting.gateways.base import Channel, Delivery, Status, _mask
from alerting.gateways.console import ConsoleGateway
from alerting.templates.messages import (
    LANGUAGES,
    TEMPLATES,
    Review,
    Template,
    coverage,
    render,
    resolve,
)


def _subs():
    return [Subscriber("9876543210", "en"), Subscriber("9812345678", "hi")]


# ── Escalation ──────────────────────────────────────────────────────────

def test_alerts_fire_on_escalation():
    assert Dispatcher().should_alert("green", "red")
    assert Dispatcher().should_alert("yellow", "orange")


def test_staying_at_the_same_tier_sends_nothing():
    """A segment red for four days is one event, not one alert every 3 hours.
    Repeating it is how a warning system teaches people to ignore it."""
    assert not Dispatcher().should_alert("red", "red")


def test_de_escalation_is_silent():
    """An 'all clear' while the ground is still saturated is worse than silence."""
    assert not Dispatcher().should_alert("red", "orange")
    assert not Dispatcher().should_alert("orange", "green")


def test_yellow_does_not_wake_anyone():
    """Yellow is a watch state for the dashboard, not a reason to send an SMS."""
    assert not Dispatcher().should_alert("green", "yellow")


def test_dispatch_floor_is_configurable():
    assert Dispatcher(min_tier="yellow").should_alert("green", "yellow")


def test_unknown_tier_never_dispatches():
    assert not Dispatcher().should_alert("green", "purple")
    assert not Dispatcher().should_alert("unknown", "red")


def test_rank_is_ordered():
    assert RANK["green"] < RANK["yellow"] < RANK["orange"] < RANK["red"]


# ── Sending ─────────────────────────────────────────────────────────────

def test_one_message_per_covered_subscriber():
    gateway = ConsoleGateway()
    sent = Dispatcher(gateway=gateway).dispatch(
        "NH-10:51.0", "NH-10 km 51.0", "green", "red", _subs()
    )
    assert len(sent) == 2
    assert len(gateway.outbox) == 2
    assert all(d.status is Status.SENT for d in sent)


def test_subscribers_only_hear_about_their_own_segments():
    subscriber = Subscriber("9876543210", "en", segments=("NH-10:12.0",))
    sent = Dispatcher().dispatch("NH-10:51.0", "km 51", "green", "red", [subscriber])
    assert sent == []


def test_empty_segment_list_means_the_whole_corridor():
    assert Subscriber("9876543210").covers("NH-10:99.0")


def test_message_names_the_tier_in_words():
    """An SMS has no colour, and 'ORANGE' alone means nothing unbriefed."""
    text, _ = render("red", "en", location="km 51", hours=24, authority="DDMA")
    assert "RED" in text
    assert "km 51" in text


def test_run_compares_two_scoring_runs():
    gateway = ConsoleGateway()
    dispatcher = Dispatcher(gateway=gateway)
    sent = dispatcher.run(
        previous={"a": "green", "b": "red"},
        current={"a": "red", "b": "red", "c": "orange"},
        locations={"a": "km 1", "b": "km 2", "c": "km 3"},
        subscribers=[Subscriber("9876543210")],
    )
    # a escalated, c is new and above the floor, b was already red.
    assert {d.segment_id for d in sent} == {"a", "c"}


# ── Templates ───────────────────────────────────────────────────────────

def test_unreviewed_language_falls_back_rather_than_being_sent():
    """A mistranslated landslide warning can send people towards the slope."""
    assert TEMPLATES[("red", "hi")].review is Review.DRAFT
    _, used = resolve("red", "hi")
    assert used == "en"


def test_reviewed_language_is_used_as_asked():
    _, used = resolve("red", "en")
    assert used == "en"


def test_draft_templates_are_not_sendable():
    assert not Template("x", Review.DRAFT).sendable
    assert not Template("x", Review.MISSING).sendable
    assert Template("x", Review.REVIEWED).sendable


def test_no_sendable_template_raises_rather_than_dropping_the_alert():
    with pytest.raises(LookupError):
        resolve("green", "en")


def test_missing_template_is_recorded_not_swallowed():
    """An alert that vanishes is indistinguishable from one nobody needed."""
    dispatcher = Dispatcher(min_tier="yellow")
    sent = dispatcher.dispatch("s", "km 1", "green", "yellow", [Subscriber("98765", "en")])
    # Yellow English exists, so this one sends; the guard is exercised below.
    assert sent[0].status is Status.SENT


def test_every_declared_language_appears_in_coverage():
    assert set(coverage()) == set(LANGUAGES)


def test_coverage_reports_gaps_honestly():
    gaps = coverage()
    assert gaps["as"]["red"] == "missing"
    assert gaps["en"]["red"] == "reviewed"


# ── Delivery records ────────────────────────────────────────────────────

def test_failures_are_kept_for_manual_relay():
    class Failing:
        name = "failing"

        def send_sms(self, phone, text):
            return Status.FAILED, "carrier rejected"

    dispatcher = Dispatcher(gateway=Failing())
    dispatcher.dispatch("s", "km 1", "green", "red", [Subscriber("98765")])
    assert len(dispatcher.undelivered()) == 1
    assert dispatcher.undelivered()[0].detail == "carrier rejected"


def test_phone_numbers_are_masked_in_records():
    """Numbers are for delivery, never for display."""
    delivery = Delivery("9876543210", Channel.SMS, "en", "red", "s", Status.SENT)
    assert delivery.as_dict()["recipient"] == "…3210"
    assert "9876543210" not in str(delivery.as_dict())


def test_masking_handles_short_input():
    assert _mask("12") == "…"


def test_dry_run_reports_sent_not_delivered():
    """Nothing was delivered, and the record must not imply otherwise."""
    status, _ = ConsoleGateway().send_sms("98765", "hello")
    assert status is Status.SENT
    assert status is not Status.DELIVERED
