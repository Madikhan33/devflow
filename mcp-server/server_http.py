"""
DevFlow MCP Server — Streamable HTTP version for Railway deployment.

Supports:
  - Streamable HTTP Transport (/mcp) — for Kimi and modern MCP clients
  - REST API (/tasks) — for VS Code extension
  - Health check (/health) — for Railway

Railway automatically sets the PORT environment variable.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mcp.server.fastmcp import FastMCP
from starlette.applications import Starlette
from starlette.routing import Mount, Route
from starlette.responses import JSONResponse
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
import uvicorn

from task_manager import (
    get_tasks,
    add_task,
    complete_task,
    start_task,
    snooze_task,
    delete_task,
)

# ── Config ────────────────────────────────────────────────────────────────
PORT = int(os.environ.get("PORT", 3000))
WORK_DIR = os.environ.get("WORK_DIR", "/workspace")

# Ensure work directory exists
os.makedirs(WORK_DIR, exist_ok=True)

# ── Create MCP Server ─────────────────────────────────────────────────────
mcp = FastMCP(
    "DevFlow",
    instructions=(
        "DevFlow is a task manager for AI-driven development. "
        "Use these tools to track your work:\n"
        "- get_all_tasks() at the start of every session\n"
        "- start_task(id) when you begin working\n"
        "- add_task(title) when you discover new work\n"
        "- complete_task(id) when a task is 100% done\n"
        "- snooze_task(id, date) if you can't finish now\n"
        "- delete_task(id) only for duplicates or invalid tasks"
    ),
    stateless_http=True,
)


@mcp.tool()
def get_all_tasks(status: str = "") -> str:
    """Get all tasks from the workspace. Optionally filter by status: pending, in_progress, done, snoozed."""
    result = get_tasks(WORK_DIR, status if status else None)
    return json.dumps(result, indent=2, ensure_ascii=False)


@mcp.tool()
def add_new_task(title: str, description: str = "") -> str:
    """Add a new task to the task list. Use when you discover new work that needs to be done."""
    task = add_task(WORK_DIR, title, description if description else None)
    return f"✅ Task added: [{task['id']}] {task['title']}"


@mcp.tool()
def mark_task_started(task_id: str) -> str:
    """Mark a task as in progress. Use when you begin working on a task."""
    task = start_task(WORK_DIR, task_id)
    if not task:
        return f"❌ Task not found: {task_id}"
    return f"🚀 Task started: [{task['id']}] {task['title']}"


@mcp.tool()
def mark_task_complete(task_id: str) -> str:
    """Mark a task as 100% done. Only use when the task is fully completed."""
    task = complete_task(WORK_DIR, task_id)
    if not task:
        return f"❌ Task not found: {task_id}"
    return f"✅ Task completed: [{task['id']}] {task['title']}"


@mcp.tool()
def snooze_a_task(task_id: str, date: str) -> str:
    """Postpone a task to a future date (YYYY-MM-DD). Use when a task cannot be finished now."""
    task = snooze_task(WORK_DIR, task_id, date)
    if not task:
        return f"❌ Task not found: {task_id}"
    return f"😴 Task snoozed until {date}: [{task['id']}] {task['title']}"


@mcp.tool()
def remove_task(task_id: str) -> str:
    """Permanently delete a task. Use only for duplicate or invalid tasks."""
    ok = delete_task(WORK_DIR, task_id)
    if not ok:
        return f"❌ Task not found: {task_id}"
    return f"🗑️ Task deleted: {task_id}"


# ── Additional HTTP endpoints ─────────────────────────────────────────────
async def health_check(request):
    """Health check endpoint for Railway."""
    return JSONResponse({"status": "ok", "service": "devflow-mcp"})


async def tasks_api(request):
    """REST API endpoint for VS Code extension to fetch tasks."""
    status_filter = request.query_params.get("status", None)
    result = get_tasks(WORK_DIR, status_filter if status_filter else None)
    return JSONResponse(result, headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    })


async def tasks_options(request):
    """Handle CORS preflight."""
    from starlette.responses import Response
    return Response(status_code=204, headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    })


def create_app():
    """Create a Starlette app with Streamable HTTP MCP + REST endpoints."""

    # Get the MCP ASGI app via FastMCP's built-in http_app()
    # This handles the /mcp endpoint with Streamable HTTP transport
    mcp_asgi_app = mcp.http_app(path="/mcp")

    # Build the combined Starlette app
    app = Starlette(
        routes=[
            Route("/", endpoint=health_check),
            Route("/health", endpoint=health_check),
            Route("/tasks", endpoint=tasks_api, methods=["GET"]),
            Route("/tasks", endpoint=tasks_options, methods=["OPTIONS"]),
            # Mount the MCP Streamable HTTP app at root so /mcp works
            Mount("/", app=mcp_asgi_app),
        ],
        middleware=[
            Middleware(
                CORSMiddleware,
                allow_origins=["*"],
                allow_methods=["*"],
                allow_headers=["*"],
            ),
        ],
    )

    return app


if __name__ == "__main__":
    print(f"🚀 DevFlow MCP Server starting on port {PORT}")
    print(f"📁 Working directory: {WORK_DIR}")
    print(f"🔗 MCP endpoint: http://0.0.0.0:{PORT}/mcp")
    print(f"💚 Health check: http://0.0.0.0:{PORT}/health")

    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=PORT)
