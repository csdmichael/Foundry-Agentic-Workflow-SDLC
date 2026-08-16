"""Request body models (validated at the API boundary)."""
from typing import List, Optional

from pydantic import BaseModel


class OtpRequestBody(BaseModel):
    email: str


class OtpVerifyBody(BaseModel):
    email: str
    code: str


class ProjectSourceBody(BaseModel):
    kind: str
    reference: str
    uploadedFiles: Optional[List[str]] = None


class ProjectCreateBody(BaseModel):
    name: str = ""
    description: str = ""
    businessOwner: str = ""
    itOwner: str = ""
    sources: List[ProjectSourceBody] = []
    adoOrganization: str = ""
    adoProject: str = ""
    gitHubRepo: str = ""
    targetEnvironment: str = "Dev"
    selectedAgentIds: List[str] = []


class AgentRunBody(BaseModel):
    prompt: Optional[str] = None


class ApprovalDecisionBody(BaseModel):
    decision: str
    comments: Optional[str] = None
    delegatedTo: Optional[str] = None
    artifactRefs: Optional[List[str]] = None


class UserUpsertBody(BaseModel):
    email: str = ""
    name: str = ""
    role: str = ""
    provider: str = ""
    disabled: Optional[bool] = False
