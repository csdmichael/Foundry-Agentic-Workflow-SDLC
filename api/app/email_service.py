"""OTP email delivery (mirror of email.service.ts).

Prefers Azure Communication Services Email when configured; otherwise logs the
code to the server console and a dev log file (DEV/DEMO ONLY).
"""
import json
import math
import os
from pathlib import Path

from .config import CONFIG
from .persistence import _data_root


def send_otp_email(email: str, code: str) -> bool:
    ext = CONFIG["api"]["auth"]["external"]
    subject = ext["emailSubject"]
    body = (
        f'Your {ext["emailFromName"]} verification code is {code}. '
        f'It expires in {math.floor(ext["otpTtlSeconds"] / 60)} minutes.'
    )

    conn = CONFIG["secrets"]["acsConnectionString"]
    sender = CONFIG["secrets"]["acsSenderAddress"] or ext["emailFrom"]
    if conn and sender:
        try:
            from azure.communication.email import EmailClient  # optional dependency

            client = EmailClient.from_connection_string(conn)
            poller = client.begin_send(
                {
                    "senderAddress": sender,
                    "content": {"subject": subject, "plainText": body},
                    "recipients": {"to": [{"address": email}]},
                }
            )
            poller.result()
            return True
        except Exception as err:  # fall through to dev fallback on transport failure
            print("ACS email send failed, using dev fallback:", err)

    _log_dev_otp(email, code)
    return False


def _log_dev_otp(email: str, code: str) -> None:
    print(f"[DEV OTP] {email} -> {code} (SMTP/ACS not configured)")
    try:
        _data_root.mkdir(parents=True, exist_ok=True)
        file = _data_root / "otp-log.json"
        entries = []
        if file.exists():
            with open(file, "r", encoding="utf-8") as f:
                entries = json.load(f)
        from .util import now_iso

        entries.insert(0, {"email": email, "code": code, "issuedAt": now_iso(), "note": "DEV/DEMO ONLY. ACS not configured."})
        with open(file, "w", encoding="utf-8") as f:
            json.dump(entries[:200], f, indent=2)
    except OSError:
        pass
