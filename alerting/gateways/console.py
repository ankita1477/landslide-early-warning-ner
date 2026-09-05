"""A gateway that prints instead of sending.

This is the default when no provider credentials are configured. It exists so
the dispatcher, the templates and the escalation logic can be exercised and
tested end to end without a paid account — and so that running the pipeline on a
laptop cannot accidentally send a real landslide warning to a real phone.

It reports SENT, not DELIVERED. Nothing was delivered.
"""

from __future__ import annotations

import logging

from alerting.gateways.base import Status

log = logging.getLogger(__name__)


class ConsoleGateway:
    name = "console (dry run — nothing is sent)"

    def __init__(self) -> None:
        self.outbox: list[tuple[str, str]] = []

    def send_sms(self, phone: str, text: str) -> tuple[Status, str]:
        self.outbox.append((phone, text))
        log.info("[dry run] SMS → %s: %s", phone, text)
        return Status.SENT, "dry run"
