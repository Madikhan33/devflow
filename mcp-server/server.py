"""
DevFlow MCP Server — Python implementation using FastMCP.

Usage:
  python server.py --dir /path/to/project

  Or via mcp.json in VS Code:
  {
    "servers": {
      "devflow": {
        "command": "python",
        "args": ["path/to/mcp-server/server.py", "--dir", "${workspaceFolder}"]
      }
    }
  }
"""

import argparse
import json
import os
import sys

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mcp.server.fastmcp import FastMCP

from task_manager import (
    get_tasks,
    add_task,
    complete_task,
    start_task,
    snooze_task,
    delete_task,
)


def main():
    # ── Parse args ────────────────────────────────────────────────────────────
    parser = argparse.ArgumentParser(description="DevFlow MCP Server")
    parser.add_argument(
        "--dir",
        type=str,
        default=os.getcwd(),
        help="Working directory where .tasks.json is stored",
    )
    args = parser.parse_args()
    
    # Validate directory
    WORK_DIR = os.path.abspath(args.dir)
    if not os.path.exists(WORK_DIR):
        print(f"Error: Directory does not exist: {WORK_DIR}", file=sys.stderr)
        sys.exit(1)
    
    if not os.path.isdir(WORK_DIR):
        print(f"Error: Path is not a directory: {WORK_DIR}", file=sys.stderr)
        sys.exit(1)
    
    print(f"DevFlow MCP Server started for: {WORK_DIR}", file=sys.stderr)
    
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
    
    # ── Tools ─────────────────────────────────────────────────────────────────
    
    @mcp.tool()
    def get_all_tasks(status: str = "") -> str:
        """Get all tasks from the workspace. Optionally filter by status: pending, in_progress, done, snoozed."""
        result = get_tasks(WORK_DIR, status if status else None)
        return json.dumps(result, indent=2, ensure_ascii=False)
    
    @mcp.tool()
    def add_new_task(title: str, description: str = "") -> str:
        """Add a new task to the task list. Use when you discover new work that needs to be done."""
        task = add_task(WORK_DIR, title, description if description else None)
        return f"Task added: [{task['id']}] {task['title']}"
    
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
    
    # ── Run ───────────────────────────────────────────────────────────────────
    mcp.run()


if __name__ == "__main__":
    main()
