"""MSG91 SMS gateway.

Used only when MSG91_AUTH_KEY is present. Indian carriers require a
pre-registered template ID under TRAI's DLT rules, so the message body is not
free text — the registered template is selected by tier and the variables are
substituted by the provider.
"""

from __future__ import annotations

import logging
import os

import httpx

from alerting.gateways.base import Status

log = logging.getLogger(__name__)

ENDPOINT = "https://control.msg91.com/api/v5/flow/"
TIMEOUT = 15.0


class Msg91Gateway:
    name = "msg91"

    def __init__(self, auth_key: str | None = None, sender_id: str | None = None) -> None:
        self.auth_key = auth_key or os.getenv("MSG91_AUTH_KEY", "")
        self.sender_id = sender_id or os.getenv("MSG91_SENDER_ID", "")
        if not self.auth_key:
            raise RuntimeError(
                "MSG91_AUTH_KEY is not set. Use ConsoleGateway for a dry run, or "
                "configure credentials in .env."
            )

    def send_sms(self, phone: str, text: str) -> tuple[Status, str]:
        try:
            response = httpx.post(
                ENDPOINT,
                headers={"authkey": self.auth_key},
                json={
                    "sender": self.sender_id,
                    "short_url": "0",
                    "recipients": [{"mobiles": _e164(phone), "MESSAGE": text}],
                },
                timeout=TIMEOUT,
            )
            if response.status_code >= 400:
                return Status.FAILED, f"http {response.status_code}"
            # The provider accepting a message is not the same as a handset
            # receiving it; delivery is confirmed later by receipt webhook.
            return Status.SENT, response.text[:120]
        except httpx.HTTPError as error:
            return Status.FAILED, str(error)[:120]


def _e164(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    return digits if digits.startswith("91") else f"91{digits}"
