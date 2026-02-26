# DevFlow ⚡

AI-driven task management via MCP protocol for VS Code.

Watch your AI agent (Claude, Cursor, Copilot) work in real-time — tasks appear, progress, and complete automatically.

```
AI работает в терминале...     DevFlow Panel:
$ npm run build                 🔄 настроить CI/CD
$ git push                      ✅ исчезает...
                                ➕ добавилась: fix build warnings
```

## 🔧 Quick Start

### 1. Установить MCP сервер (Python)

```bash
cd devflow/mcp-server
poetry install
```

### 2. Подключить AI клиент

#### Claude Desktop / Cursor / VS Code Copilot

Создай `.vscode/mcp.json` в рабочем проекте:

```json
{
  "servers": {
    "devflow": {
      "command": "poetry",
      "args": [
        "run", "python",
        "C:/Users/madik/OneDrive/Документы/mcp_task/devflow/mcp-server/server.py",
        "--dir", "${workspaceFolder}"
      ]
    }
  }
}
```

#### Или для Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "devflow": {
      "command": "poetry",
      "args": [
        "run", "python",
        "C:/Users/madik/OneDrive/Документы/mcp_task/devflow/mcp-server/server.py",
        "--dir", "C:/path/to/your/project"
      ],
      "cwd": "C:/Users/madik/OneDrive/Документы/mcp_task/devflow/mcp-server"
    }
  }
}
```

### 3. System Prompt для AI

```
You have access to a task manager via MCP (DevFlow).

Rules:
- Check get_all_tasks() at the start of every session
- When you begin a task → mark_task_started(task_id)
- If you discover new work → add_new_task(title)
- If a task is 100% done → mark_task_complete(task_id)
- If you can't finish now → snooze_a_task(task_id, "YYYY-MM-DD")
- Never leave tasks in "in_progress" when you stop
```

### 4. VS Code Extension (визуализация)

```bash
cd devflow
npm install
npm run compile
```

Потом **F5** в VS Code → откроется Extension Development Host с панелью DevFlow.

---

## 🛠️ MCP Tools (Python)

| Tool | Params | Description |
|------|--------|-------------|
| `get_all_tasks` | `status?` | Все задачи + статистика |
| `add_new_task` | `title`, `description?` | Добавить задачу |
| `mark_task_started` | `task_id` | Начать работу над задачей |
| `mark_task_complete` | `task_id` | Отметить как выполненную |
| `snooze_a_task` | `task_id`, `date` | Перенести на другой день |
| `remove_task` | `task_id` | Удалить задачу |

## 📁 Структура проекта

```
devflow/
├── mcp-server/               ← Python MCP сервер
│   ├── server.py             # FastMCP сервер с 6 инструментами
│   ├── task_manager.py       # CRUD для .tasks.json
│   └── pyproject.toml        # Poetry dependencies
├── src/                      ← VS Code Extension (TypeScript)
│   ├── extension.ts          # Entry point
│   ├── taskTreeProvider.ts   # Sidebar tree view
│   ├── taskManager.ts        # TS версия CRUD (для extension)
│   └── webview/panel.ts      # Дашборд панель
├── dist/
│   └── extension.js          # Bundled extension
├── .tasks.json               # ← создаётся в проекте юзера
└── package.json
```

## 📋 Task Schema (`.tasks.json`)

```json
{
  "version": 1,
  "lastUpdated": "2025-01-15T12:00:00Z",
  "tasks": [
    {
      "id": "a1b2c3d4",
      "title": "Fix build warnings",
      "description": "Remove unused imports in src/",
      "status": "pending",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

## License

MIT
