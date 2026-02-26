# DevFlow MCP Server ⚡

AI-driven task management via MCP protocol.

## 🚀 Deploy on Railway

### One-click deploy

1. Fork this repo
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Set **Root Directory** to `mcp-server`
4. Railway auto-detects the Dockerfile and deploys

### Environment Variables (optional)

| Variable   | Default      | Description                           |
|------------|-------------|---------------------------------------|
| `PORT`     | `3000`      | Server port (auto-set by Railway)     |
| `WORK_DIR` | `/workspace` | Directory for `.tasks.json` storage  |

### Endpoints

| Path        | Description            |
|-------------|------------------------|
| `/`         | Health check (JSON)    |
| `/health`   | Health check (JSON)    |
| `/sse`      | SSE endpoint for MCP   |
| `/messages/` | Message transport     |

## 🔧 Connect your AI client

After deploying, use the Railway URL as your MCP endpoint:

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "devflow": {
      "url": "https://YOUR-APP.up.railway.app/sse"
    }
  }
}
```

### VS Code / Cursor (`.vscode/mcp.json`)

```json
{
  "servers": {
    "devflow": {
      "url": "https://YOUR-APP.up.railway.app/sse"
    }
  }
}
```

## 🛠️ MCP Tools

| Tool               | Params                 | Description                        |
|--------------------|------------------------|------------------------------------|
| `get_all_tasks`    | `status?`              | Get all tasks + statistics         |
| `add_new_task`     | `title`, `description?`| Add a new task                     |
| `mark_task_started`| `task_id`              | Start working on a task            |
| `mark_task_complete`| `task_id`             | Mark task as done                  |
| `snooze_a_task`    | `task_id`, `date`      | Postpone to a future date          |
| `remove_task`      | `task_id`              | Delete a task permanently          |

## 🏃 Run locally

```bash
pip install -r requirements.txt
python server_http.py
```

Server starts on `http://localhost:3000/sse`.

## 📋 Task Schema (`.tasks.json`)

```json
{
  "version": 1,
  "lastUpdated": "2026-01-15T12:00:00Z",
  "tasks": [
    {
      "id": "a1b2c3d4",
      "title": "Fix build warnings",
      "description": "Remove unused imports",
      "status": "pending",
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ]
}
```

## License

MIT
