"""
DevFlow Task Manager — CRUD operations for .tasks.json
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ── Types ────────────────────────────────────────────────────────────────────

TASKS_FILENAME = ".tasks.json"

VALID_STATUSES = {"pending", "in_progress", "done", "snoozed"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _generate_id() -> str:
    return uuid.uuid4().hex[:8]


def _tasks_path(directory: str) -> Path:
    return Path(directory) / TASKS_FILENAME


# ── Load / Save ──────────────────────────────────────────────────────────────


def load_tasks(directory: str) -> dict:
    """Load tasks from .tasks.json or return empty structure."""
    path = _tasks_path(directory)
    if not path.exists():
        return {"version": 1, "tasks": [], "lastUpdated": _now()}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {"version": 1, "tasks": [], "lastUpdated": _now()}


def save_tasks(directory: str, data: dict) -> None:
    """Save tasks to .tasks.json."""
    data["lastUpdated"] = _now()
    path = _tasks_path(directory)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ── Operations ───────────────────────────────────────────────────────────────


def get_tasks(directory: str, status: Optional[str] = None) -> dict:
    """Get all tasks with summary statistics."""
    data = load_tasks(directory)
    tasks = data["tasks"]

    if status and status in VALID_STATUSES:
        filtered = [t for t in tasks if t["status"] == status]
    else:
        filtered = tasks

    counts = {}
    for s in VALID_STATUSES:
        counts[s] = sum(1 for t in tasks if t["status"] == s)

    return {
        "summary": {
            "total": len(tasks),
            "pending": counts.get("pending", 0),
            "in_progress": counts.get("in_progress", 0),
            "done": counts.get("done", 0),
            "snoozed": counts.get("snoozed", 0),
        },
        "tasks": filtered,
    }


def add_task(
    directory: str, title: str, description: Optional[str] = None
) -> dict:
    """Add a new task and return it."""
    data = load_tasks(directory)
    task = {
        "id": _generate_id(),
        "title": title,
        "status": "pending",
        "createdAt": _now(),
    }
    if description:
        task["description"] = description
    data["tasks"].append(task)
    save_tasks(directory, data)
    return task


def complete_task(directory: str, task_id: str) -> Optional[dict]:
    """Mark a task as done."""
    data = load_tasks(directory)
    for task in data["tasks"]:
        if task["id"] == task_id:
            task["status"] = "done"
            task["completedAt"] = _now()
            save_tasks(directory, data)
            return task
    return None


def start_task(directory: str, task_id: str) -> Optional[dict]:
    """Mark a task as in progress."""
    data = load_tasks(directory)
    for task in data["tasks"]:
        if task["id"] == task_id:
            task["status"] = "in_progress"
            save_tasks(directory, data)
            return task
    return None


def snooze_task(
    directory: str, task_id: str, date: str
) -> Optional[dict]:
    """Snooze a task until a specific date."""
    data = load_tasks(directory)
    for task in data["tasks"]:
        if task["id"] == task_id:
            task["status"] = "snoozed"
            task["snoozedUntil"] = date
            save_tasks(directory, data)
            return task
    return None


def delete_task(directory: str, task_id: str) -> bool:
    """Delete a task permanently."""
    data = load_tasks(directory)
    original_len = len(data["tasks"])
    data["tasks"] = [t for t in data["tasks"] if t["id"] != task_id]
    if len(data["tasks"]) < original_len:
        save_tasks(directory, data)
        return True
    return False
