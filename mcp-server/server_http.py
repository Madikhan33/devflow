"""
DevFlow MCP Server — SSE HTTP version for Railway deployment.

Supports:
  - SSE Transport (/sse, /messages/) — for Kimi and MCP clients
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
    return f" Task added: [{task['id']}] {task['title']}"


@mcp.tool()
def mark_task_started(task_id: str) -> str:
    """Mark a task as in progress. Use when you begin working on a task."""
    task = start_task(WORK_DIR, task_id)
    if not task:
        return f"Task not found: {task_id}"
    return f"Task started: [{task['id']}] {task['title']}"


@mcp.tool()
def mark_task_complete(task_id: str) -> str:
    """Mark a task as 100% done. Only use when the task is fully completed."""
    task = complete_task(WORK_DIR, task_id)
    if not task:
        return f"Task not found: {task_id}"
    return f"Task completed: [{task['id']}] {task['title']}"


@mcp.tool()
def snooze_a_task(task_id: str, date: str) -> str:
    """Postpone a task to a future date (YYYY-MM-DD). Use when a task cannot be finished now."""
    task = snooze_task(WORK_DIR, task_id, date)
    if not task:
        return f"Task not found: {task_id}"
    return f"Task snoozed until {date}: [{task['id']}] {task['title']}"


@mcp.tool()
def remove_task(task_id: str) -> str:
    """Permanently delete a task. Use only for duplicate or invalid tasks."""
    ok = delete_task(WORK_DIR, task_id)
    if not ok:
        return f"Task not found: {task_id}"
    return f"Task deleted: {task_id}"


# ── Additional HTTP endpoints ─────────────────────────────────────────────
async def health_check(request):
    """Health check endpoint for Railway."""
    return JSONResponse({"status": "ok", "service": "devflow-mcp"})


# ── HTTP JSON-RPC endpoint for Kimi CLI ───────────────────────────────────
async def mcp_http_endpoint(request):
    """HTTP JSON-RPC endpoint for MCP clients (Kimi CLI)."""
    import json
    from mcp.types import JSONRPCRequest, JSONRPCResponse, JSONRPCError
    
    try:
        body = await request.body()
        data = json.loads(body)
        
        # Handle JSON-RPC request
        jsonrpc_version = data.get("jsonrpc", "2.0")
        method = data.get("method", "")
        params = data.get("params", {})
        request_id = data.get("id")
        
        # Handle initialize method
        if method == "initialize":
            result = {
                "protocolVersion": "2024-11-05",
                "serverInfo": {"name": "DevFlow", "version": "0.1.0"},
                "capabilities": {
                    "tools": {},
                    "logging": {}
                }
            }
            return JSONResponse({
                "jsonrpc": "2.0",
                "result": result,
                "id": request_id
            })
        
        # Handle tools/list method
        elif method == "tools/list":
            result = {
                "tools": [
                    {
                        "name": "get_all_tasks",
                        "description": "Get all tasks from the workspace. Optionally filter by status: pending, in_progress, done, snoozed.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "status": {"type": "string", "description": "Optional status filter"}
                            }
                        }
                    },
                    {
                        "name": "add_new_task",
                        "description": "Add a new task to the task list. Use when you discover new work that needs to be done.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string", "description": "Task title"},
                                "description": {"type": "string", "description": "Optional task description"}
                            },
                            "required": ["title"]
                        }
                    },
                    {
                        "name": "mark_task_started",
                        "description": "Mark a task as in progress. Use when you begin working on a task.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "task_id": {"type": "string", "description": "Task ID to start"}
                            },
                            "required": ["task_id"]
                        }
                    },
                    {
                        "name": "mark_task_complete",
                        "description": "Mark a task as 100% done. Only use when the task is fully completed.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "task_id": {"type": "string", "description": "Task ID to complete"}
                            },
                            "required": ["task_id"]
                        }
                    },
                    {
                        "name": "snooze_a_task",
                        "description": "Postpone a task to a future date (YYYY-MM-DD). Use when a task cannot be finished now.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "task_id": {"type": "string", "description": "Task ID to snooze"},
                                "date": {"type": "string", "description": "Date to snooze until (YYYY-MM-DD)"}
                            },
                            "required": ["task_id", "date"]
                        }
                    },
                    {
                        "name": "remove_task",
                        "description": "Permanently delete a task. Use only for duplicate or invalid tasks.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "task_id": {"type": "string", "description": "Task ID to delete"}
                            },
                            "required": ["task_id"]
                        }
                    }
                ]
            }
            return JSONResponse({
                "jsonrpc": "2.0",
                "result": result,
                "id": request_id
            })
        
        # Handle tools/call method
        elif method == "tools/call":
            tool_name = params.get("name", "")
            tool_args = params.get("arguments", {})
            
            # Map tool names to functions
            if tool_name == "get_all_tasks":
                status = tool_args.get("status", "")
                result = get_tasks(WORK_DIR, status if status else None)
                content = [{"type": "text", "text": json.dumps(result, indent=2, ensure_ascii=False)}]
            
            elif tool_name == "add_new_task":
                title = tool_args.get("title", "")
                description = tool_args.get("description", "")
                task = add_task(WORK_DIR, title, description if description else None)
                content = [{"type": "text", "text": f"Task added: [{task['id']}] {task['title']}"}]
            
            elif tool_name == "mark_task_started":
                task_id = tool_args.get("task_id", "")
                task = start_task(WORK_DIR, task_id)
                if not task:
                    content = [{"type": "text", "text": f"Task not found: {task_id}"}]
                else:
                    content = [{"type": "text", "text": f"Task started: [{task['id']}] {task['title']}"}]
            
            elif tool_name == "mark_task_complete":
                task_id = tool_args.get("task_id", "")
                task = complete_task(WORK_DIR, task_id)
                if not task:
                    content = [{"type": "text", "text": f"Task not found: {task_id}"}]
                else:
                    content = [{"type": "text", "text": f"Task completed: [{task['id']}] {task['title']}"}]
            
            elif tool_name == "snooze_a_task":
                task_id = tool_args.get("task_id", "")
                date = tool_args.get("date", "")
                task = snooze_task(WORK_DIR, task_id, date)
                if not task:
                    content = [{"type": "text", "text": f"Task not found: {task_id}"}]
                else:
                    content = [{"type": "text", "text": f"Task snoozed until {date}: [{task['id']}] {task['title']}"}]
            
            elif tool_name == "remove_task":
                task_id = tool_args.get("task_id", "")
                ok = delete_task(WORK_DIR, task_id)
                if not ok:
                    content = [{"type": "text", "text": f"Task not found: {task_id}"}]
                else:
                    content = [{"type": "text", "text": f"Task deleted: {task_id}"}]
            
            else:
                content = [{"type": "text", "text": f"Unknown tool: {tool_name}"}]
            
            return JSONResponse({
                "jsonrpc": "2.0",
                "result": {"content": content},
                "id": request_id
            })
        
        # Unknown method
        else:
            return JSONResponse({
                "jsonrpc": "2.0",
                "error": {"code": -32601, "message": f"Method not found: {method}"},
                "id": request_id
            })
    
    except Exception as e:
        import traceback
        return JSONResponse({
            "jsonrpc": "2.0",
            "error": {"code": -32603, "message": str(e)},
            "id": data.get("id") if isinstance(data, dict) else None
        })


async def mcp_http_options(request):
    """Handle CORS preflight for /mcp."""
    from starlette.responses import Response
    return Response(status_code=204, headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
    })


async def tasks_api(request):
    """REST API endpoint for VS Code extension to fetch tasks."""
    status_filter = request.query_params.get("status", None)
    result = get_tasks(WORK_DIR, status_filter if status_filter else None)
    return JSONResponse(result, headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    })


async def tasks_api_delete(request):
    """DELETE endpoint for VS Code extension to delete a task."""
    task_id = request.path_params.get("task_id", "")
    if not task_id:
        # Try query param as fallback
        task_id = request.query_params.get("id", "")
    
    if not task_id:
        return JSONResponse(
            {"error": "Task ID is required"},
            status_code=400,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            }
        )
    
    ok = delete_task(WORK_DIR, task_id)
    if not ok:
        return JSONResponse(
            {"error": f"Task not found: {task_id}"},
            status_code=404,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            }
        )
    
    return JSONResponse(
        {"success": True, "message": f"Task deleted: {task_id}"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )


async def tasks_options(request):
    """Handle CORS preflight."""
    from starlette.responses import Response
    return Response(status_code=204, headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    })


def create_app():
    """Create a Starlette app with SSE MCP + REST endpoints."""
    from mcp.server.sse import SseServerTransport

    sse_transport = SseServerTransport("/messages/")

    async def handle_sse(scope, receive, send):
        """Raw ASGI handler for SSE connection."""
        async with sse_transport.connect_sse(scope, receive, send) as streams:
            # For newer python mcp packages, mcp instance might have _mcp_server
            await mcp._mcp_server.run(
                streams[0], streams[1], mcp._mcp_server.create_initialization_options()
            )

    async def sse_app(scope, receive, send):
        """Wrapper that only handles HTTP requests to /sse."""
        if scope["type"] == "http":
            await handle_sse(scope, receive, send)

    # Build the combined Starlette app
    app = Starlette(
        routes=[
            Route("/", endpoint=health_check),
            Route("/health", endpoint=health_check),
            Route("/tasks", endpoint=tasks_api, methods=["GET"]),
            Route("/tasks/{task_id}", endpoint=tasks_api_delete, methods=["DELETE"]),
            Route("/tasks", endpoint=tasks_options, methods=["OPTIONS"]),
            # HTTP JSON-RPC endpoint for Kimi CLI
            Route("/mcp", endpoint=mcp_http_endpoint, methods=["POST"]),
            Route("/mcp", endpoint=mcp_http_options, methods=["OPTIONS"]),
            # SSE Endpoints for MCP Clients like Kimi
            Mount("/sse", app=sse_app),
            Mount("/messages/", app=sse_transport.handle_post_message),
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
    print(f"DevFlow MCP Server starting on port {PORT}")
    print(f"Working directory: {WORK_DIR}")
    print(f"MCP HTTP endpoint: http://0.0.0.0:{PORT}/mcp")
    print(f"MCP SSE endpoint: http://0.0.0.0:{PORT}/sse")
    print(f"Health check: http://0.0.0.0:{PORT}/health")

    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=PORT)
