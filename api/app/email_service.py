"""OTP email delivery (mirror of email.service.ts).

Prefers Azure Communication Services Email when configured; otherwise logs the
code to the server console and a dev log file (DEV/DEMO ONLY).
"""
import json
import logging
import math
import os
from pathlib import Path

from .config import CONFIG
from .persistence import _data_root

logger = logging.getLogger(__name__)


def send_otp_email(email: str, code: str) -> bool:
    ext = CONFIG["api"]["auth"]["external"]
    subject = ext["emailSubject"]
    body = (
        f'Your {ext["emailFromName"]} verification code is {code}. '
        f'It expires in {math.floor(ext["otpTtlSeconds"] / 60)} minutes.'
    )

    conn = CONFIG["secrets"]["acsConnectionString"]
    sender = CONFIG["secrets"]["acsSenderAddress"]
    if not conn or not sender:
        logger.warning(
            "OTP email not sent: ACS is not configured "
            "(AUTH_ACS_CONNECTION_STRING set=%s, AUTH_ACS_SENDER_ADDRESS set=%s).",
            bool(conn),
            bool(sender),
        )
    else:
        try:
            from azure.communication.email import EmailClient

            client = EmailClient.from_connection_string(conn)
            poller = client.begin_send(
                {
                    "senderAddress": sender,
                    "content": {"subject": subject, "plainText": body},
                    "recipients": {"to": [{"address": email}]},
                }
            )
            result = poller.result()
            status = (result or {}).get("status") if isinstance(result, dict) else None
            logger.info("OTP email sent via ACS to %s (status=%s).", email, status)
            return True
        except ImportError:
            logger.error(
                "OTP email not sent: the 'azure-communication-email' package is missing. "
                "Add it to api/requirements.txt and redeploy."
            )
        except Exception:  # fall through to dev fallback on transport failure
            logger.exception("ACS email send failed for %s, using dev fallback.", email)

    _log_dev_otp(email, code)
    return False


def _log_dev_otp(email: str, code: str) -> None:
    # Plaintext codes are only ever persisted when the dev bypass flag is on.
    if not CONFIG["flags"]["otpDevBypass"]:
        logger.error("OTP for %s could not be delivered and dev logging is disabled.", email)
        return
    logger.warning("[DEV OTP] %s -> %s (ACS not configured or send failed)", email, code)
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
