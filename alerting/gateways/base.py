"""Gateway interface and delivery records."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Protocol


class Channel(str, Enum):
    SMS = "sms"
    IVR = "ivr"


class Status(str, Enum):
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class Delivery:
    """One attempt to reach one recipient.

    Kept even when it fails. An undelivered alert has to be visible so it can be
    escalated to the control room for manual relay — a failure that is not
    recorded is indistinguishable from an alert nobody needed.
    """

    recipient: str
    channel: Channel
    language: str
    tier: str
    segment_id: str
    status: Status
    text: str = ""
    detail: str = ""
    attempts: int = 0
    at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def as_dict(self) -> dict:
        return {
            "recipient": _mask(self.recipient),
            "channel": self.channel.value,
            "language": self.language,
            "tier": self.tier,
            "segment_id": self.segment_id,
            "status": self.status.value,
            "attempts": self.attempts,
            "detail": self.detail,
            "at": self.at.isoformat(timespec="seconds"),
        }


def _mask(phone: str) -> str:
    """Phone numbers are for delivery, never for display. Logs and exports keep
    only enough to identify a record in a support call."""
    digits = "".join(c for c in phone if c.isdigit())
    return f"…{digits[-4:]}" if len(digits) >= 4 else "…"


class Gateway(Protocol):
    name: str

    def send_sms(self, phone: str, text: str) -> tuple[Status, str]: ...
