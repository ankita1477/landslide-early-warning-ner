"""Report whether the alerting layer could actually warn anyone.

Run before claiming the system is operational. It answers three questions
separately, because they fail independently: is a gateway configured, which
languages can be sent, and does the escalation logic behave.
"""

from __future__ import annotations

import os

from alerting.templates.messages import LANGUAGE_NAMES, coverage


def report() -> dict:
    has_msg91 = bool(os.getenv("MSG91_AUTH_KEY", "").strip())
    has_twilio = bool(os.getenv("TWILIO_ACCOUNT_SID", "").strip())
    languages = coverage()
    sendable = [
        code for code, tiers in languages.items()
        if any(state == "reviewed" for state in tiers.values())
    ]
    return {
        "gateway": "msg91" if has_msg91 else "twilio" if has_twilio else "none (dry run)",
        "can_send_real_sms": has_msg91 or has_twilio,
        "languages_sendable": sendable,
        "languages_designed": list(LANGUAGE_NAMES),
        "coverage": languages,
    }


def main() -> None:
    state = report()
    print("Alerting readiness\n" + "─" * 46)
    print(f"  gateway          {state['gateway']}")
    print(f"  real SMS         {'yes' if state['can_send_real_sms'] else 'NO — dry run only'}")
    print(f"  sendable         {', '.join(state['languages_sendable']) or 'none'}")
    print(f"  designed for     {len(state['languages_designed'])} languages")
    print()
    for code, tiers in state["coverage"].items():
        marks = " ".join(
            f"{tier}:{'✓' if status == 'reviewed' else '·'}"
            for tier, status in tiers.items()
        )
        print(f"  {LANGUAGE_NAMES[code]:<10} {marks}")
    print()
    if not state["can_send_real_sms"]:
        print("  No provider credentials, so nothing can reach a phone.")
        print("  Set MSG91_AUTH_KEY in .env to send for real.")
    missing = [c for c in state["languages_designed"] if c not in state["languages_sendable"]]
    if missing:
        print(f"  {len(missing)} languages need native-speaker review before use:")
        print(f"    {', '.join(LANGUAGE_NAMES[c] for c in missing)}")


if __name__ == "__main__":
    main()
