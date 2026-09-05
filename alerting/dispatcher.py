"""Decide when an alert is warranted, and send it.

The rule that matters most here is that alerts fire on tier **escalation**, not
on tier. A segment that sits at Red for four days is one event, not thirty-two
alerts at a three-hourly cadence. Sending the latter is how a warning system
teaches people to ignore it, and by the time it matters they will have.

De-escalation is silent by default. A slope dropping from Red to Orange is still
dangerous, and an "all clear" that arrives while the ground is saturated is a
worse error than saying nothing.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from alerting.gateways.base import Channel, Delivery, Gateway, Status
from alerting.gateways.console import ConsoleGateway
from alerting.templates.messages import render

log = logging.getLogger(__name__)

RANK = {"green": 0, "yellow": 1, "orange": 2, "red": 3}

# Below this tier nothing is dispatched. Yellow is a watch state for officials on
# the dashboard, not a reason to wake a subscriber at 3am.
MIN_DISPATCH_TIER = "orange"

DEFAULT_AUTHORITY = "district control room"


@dataclass
class Subscriber:
    phone: str
    language: str = "en"
    segments: tuple[str, ...] = ()      # empty means the whole corridor
    channel: Channel = Channel.SMS

    def covers(self, segment_id: str) -> bool:
        return not self.segments or segment_id in self.segments


@dataclass
class Dispatcher:
    gateway: Gateway = field(default_factory=ConsoleGateway)
    horizon_hours: int = 24
    authority: str = DEFAULT_AUTHORITY
    min_tier: str = MIN_DISPATCH_TIER
    log_: list[Delivery] = field(default_factory=list)

    def should_alert(self, previous_tier: str, new_tier: str) -> bool:
        """True only on an escalation that reaches the dispatch floor."""
        if new_tier not in RANK or previous_tier not in RANK:
            return False
        if RANK[new_tier] <= RANK[previous_tier]:
            return False
        return RANK[new_tier] >= RANK[self.min_tier]

    def dispatch(
        self,
        segment_id: str,
        location: str,
        previous_tier: str,
        new_tier: str,
        subscribers: list[Subscriber],
    ) -> list[Delivery]:
        """Send one alert per covered subscriber, and record every attempt."""
        if not self.should_alert(previous_tier, new_tier):
            log.debug("%s: %s → %s, no dispatch", segment_id, previous_tier, new_tier)
            return []

        deliveries: list[Delivery] = []
        for subscriber in subscribers:
            if not subscriber.covers(segment_id):
                continue

            try:
                text, language = render(
                    new_tier,
                    subscriber.language,
                    location=location,
                    hours=self.horizon_hours,
                    authority=self.authority,
                )
            except LookupError as error:
                # No sendable template. Record it so the control room can relay
                # manually rather than the alert vanishing.
                deliveries.append(Delivery(
                    recipient=subscriber.phone, channel=subscriber.channel,
                    language=subscriber.language, tier=new_tier, segment_id=segment_id,
                    status=Status.SKIPPED, detail=str(error),
                ))
                continue

            status, detail = self.gateway.send_sms(subscriber.phone, text)
            deliveries.append(Delivery(
                recipient=subscriber.phone, channel=subscriber.channel,
                language=language, tier=new_tier, segment_id=segment_id,
                status=status, text=text, detail=detail, attempts=1,
            ))

        self.log_.extend(deliveries)
        sent = sum(1 for d in deliveries if d.status is Status.SENT)
        log.info(
            "%s escalated %s → %s: %d sent, %d not delivered",
            segment_id, previous_tier, new_tier, sent, len(deliveries) - sent,
        )
        return deliveries

    def run(
        self,
        previous: dict[str, str],
        current: dict[str, str],
        locations: dict[str, str],
        subscribers: list[Subscriber],
    ) -> list[Delivery]:
        """Compare two scoring runs and dispatch on every escalation."""
        deliveries: list[Delivery] = []
        for segment_id, new_tier in current.items():
            deliveries += self.dispatch(
                segment_id,
                locations.get(segment_id, segment_id),
                previous.get(segment_id, "green"),
                new_tier,
                subscribers,
            )
        return deliveries

    def undelivered(self) -> list[Delivery]:
        """Everything that needs manual relay."""
        return [d for d in self.log_ if d.status in (Status.FAILED, Status.SKIPPED)]
