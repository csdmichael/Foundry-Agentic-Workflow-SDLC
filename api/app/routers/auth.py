from fastapi import APIRouter, Depends

from .. import audit_service, security
from ..errors import ApiError
from ..models import OtpRequestBody, OtpVerifyBody
from ..security import correlation_id, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/meta")
def meta():
    return security.auth_meta()


@router.post("/otp/request")
def otp_request(body: OtpRequestBody, corr: str = Depends(correlation_id)):
    email = (body.email or "").strip()
    if not email or "@" not in email:
        raise ApiError(400, "Valid email required")
    result = security.request_otp(email)
    audit_service.record(
        actor_type="system",
        actor=email,
        action="auth.otp.request",
        target_type="auth",
        target_id=email,
        correlation_id=corr,
    )
    return {"requested": True, "delivered": result["delivered"]}


@router.post("/otp/verify")
def otp_verify(body: OtpVerifyBody, corr: str = Depends(correlation_id)):
    email = (body.email or "").strip()
    code = (body.code or "").strip()
    result = security.verify_otp(email, code)
    audit_service.record(
        actor_type="user",
        actor=email,
        action="auth.otp.verify",
        target_type="auth",
        target_id=email,
        correlation_id=corr,
    )
    return {
        "accessToken": result["token"],
        "tokenType": "Bearer",
        "expiresIn": result["expiresIn"],
        "user": result["user"],
    }


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return {"user": user}


@router.post("/guest")
def guest(corr: str = Depends(correlation_id)):
    result = security.issue_guest()
    audit_service.record(
        actor_type="system",
        actor=result["user"]["email"],
        action="auth.guest.start",
        target_type="auth",
        target_id=result["user"]["sub"],
        correlation_id=corr,
    )
    return {
        "accessToken": result["token"],
        "tokenType": "Bearer",
        "expiresIn": result["expiresIn"],
        "user": result["user"],
    }
