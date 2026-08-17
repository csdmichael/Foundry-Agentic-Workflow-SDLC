"""Microsoft Agent Framework graph for one governed SDLC agent action."""
import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict

from agent_framework import (
    Executor,
    FileCheckpointStorage,
    WorkflowBuilder,
    WorkflowContext,
    handler,
    response_handler,
)

from . import approvals
from .config import API_DIR, CONFIG


@dataclass
class ApprovalRequest:
    workflow_run_id: str
    project_id: str
    lifecycle_stage: str
    agent_id: str


@dataclass
class ApprovalResponse:
    approved: bool
    comments: str = ""


class ApprovalExecutor(Executor):
    def __init__(self, agent: Dict) -> None:
        super().__init__(f'approval-{agent["agentId"]}')
        self.agent = agent

    @handler
    async def check(self, message: Dict, ctx: WorkflowContext) -> None:
        if not self.agent["requiresHumanApproval"] or approvals.is_agent_approved(
            message["workflowRunId"], self.agent
        ):
            await ctx.send_message(message)
            return

        await ctx.request_info(
            ApprovalRequest(
                workflow_run_id=message["workflowRunId"],
                project_id=message["projectId"],
                lifecycle_stage=self.agent["lifecycleStage"],
                agent_id=self.agent["agentId"],
            ),
            ApprovalResponse,
            request_id=f'{message["workflowRunId"]}:{self.agent["lifecycleStage"]}:{self.agent["agentId"]}',
        )

    @response_handler(request=ApprovalRequest, response=ApprovalResponse)
    async def resume(
        self,
        request: ApprovalRequest,
        response: ApprovalResponse,
        ctx: WorkflowContext,
    ) -> None:
        if response.approved:
            await ctx.send_message(
                {
                    "workflowRunId": request.workflow_run_id,
                    "projectId": request.project_id,
                    "agentId": request.agent_id,
                }
            )


class ApimAgentExecutor(Executor):
    def __init__(self, execute: Callable[[Dict], Dict], agent_id: str) -> None:
        super().__init__(f"apim-agent-{agent_id}")
        self._execute_agent = execute

    @handler
    async def invoke(self, message: Dict, ctx: WorkflowContext) -> None:
        await ctx.send_message(self._execute_agent(message))


class IntegrationExecutor(Executor):
    def __init__(self, agent_id: str) -> None:
        super().__init__(f"integrations-{agent_id}")

    @handler
    async def complete(self, message: Dict, ctx: WorkflowContext) -> None:
        await ctx.yield_output(message)


def _checkpoint_storage() -> FileCheckpointStorage:
    configured = Path(CONFIG["persistence"]["file"]["dataRoot"])
    data_root = configured if configured.is_absolute() else (API_DIR.parent / configured).resolve()
    checkpoint_root = data_root / "workflow-checkpoints"
    checkpoint_root.mkdir(parents=True, exist_ok=True)
    return FileCheckpointStorage(checkpoint_root)


async def _run(inp: Dict, agent: Dict, execute: Callable[[Dict], Dict]):
    approval = ApprovalExecutor(agent)
    apim_agent = ApimAgentExecutor(execute, agent["agentId"])
    integrations = IntegrationExecutor(agent["agentId"])
    workflow = (
        WorkflowBuilder(
            start_executor=approval,
            checkpoint_storage=_checkpoint_storage(),
            name="agentic-sdlc-human-in-the-loop",
            description="Approval-gated SDLC agent execution through APIM and governed integrations.",
        )
        .add_edge(approval, apim_agent)
        .add_edge(apim_agent, integrations)
        .build()
    )
    return await workflow.run(inp, include_status_events=True)


def run(inp: Dict, agent: Dict, execute: Callable[[Dict], Dict]) -> Dict:
    result = asyncio.run(_run(inp, agent, execute))
    outputs = result.get_outputs()
    if outputs:
        return outputs[-1]
    if any(event.type == "request_info" for event in result):
        raise approvals.ApprovalRequiredError(agent["lifecycleStage"])
    raise RuntimeError("Agent workflow completed without an output or approval request")