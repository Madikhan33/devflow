# DevFlow MCP Server

[![smithery badge](https://smithery.ai/badge/@madik/devflow)](https://smithery.ai/server/@madik/devflow)

AI-driven task management via MCP protocol. Watch your AI agent work in real-time.

## 🚀 Установка через Smithery (рекомендуется)

```bash
npx -y @smithery/cli install @madik/devflow --client cursor
```

Или для Claude Desktop:
```bash
npx -y @smithery/cli install @madik/devflow --client claude
```

## 📦 Ручная установка

### Требования
- Python 3.11+
- pip или poetry

### Установка

**Через pip:**
```bash
pip install mcp>=1.26.0
python server.py --dir /path/to/project
```

**Через Poetry:**
```bash
poetry install
poetry run python server.py --dir /path/to/project
```

**Через Docker:**
```bash
docker build -t devflow-mcp .
docker run -v /path/to/project:/workspace devflow-mcp --dir /workspace
```

## 🔌 Настройка в редакторах

### VS Code / Cursor / Antigravity
Создай файл `.vscode/mcp.json`:
```json
{
  "servers": {
    "devflow": {
      "command": "python",
      "args": [
        "path/to/mcp-server/server.py",
        "--dir", "${workspaceFolder}"
      ]
    }
  }
}
```

### Claude Desktop
`claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "devflow": {
      "command": "python",
      "args": [
        "path/to/mcp-server/server.py",
        "--dir", "/path/to/project"
      ]
    }
  }
}
```

### Kimi Code CLI
```bash
kimi mcp add --transport stdio devflow -- python /path/to/server.py --dir "$PWD"
```

## 🛠️ Доступные инструменты

| Инструмент | Описание | Параметры |
|------------|----------|-----------|
| `get_all_tasks` | Получить все задачи со статистикой | `status` (optional): pending, in_progress, done, snoozed |
| `add_new_task` | Добавить новую задачу | `title` (required), `description` (optional) |
| `mark_task_started` | Начать выполнение задачи | `task_id` (required) |
| `mark_task_complete` | Отметить задачу выполненной | `task_id` (required) |
| `snooze_a_task` | Отложить задачу | `task_id` (required), `date` (required): YYYY-MM-DD |
| `remove_task` | Удалить задачу | `task_id` (required) |

## 📝 System Prompt для AI

Добавь это в инструкции к AI:

```
You have access to DevFlow task manager via MCP.

Rules:
- Check get_all_tasks() at the start of every session
- When you begin a task → mark_task_started(task_id)
- If you discover new work → add_new_task(title)
- If a task is 100% done → mark_task_complete(task_id)
- If you can't finish now → snooze_a_task(task_id, "YYYY-MM-DD")
- Never leave tasks in "in_progress" when you stop
```

## 📁 Формат данных

Задачи хранятся в файле `.tasks.json`:

```json
{
  "version": 1,
  "lastUpdated": "2026-02-26T20:00:00Z",
  "tasks": [
    {
      "id": "a1b2c3d4",
      "title": "Fix bug in auth",
      "description": "Users can't login with Google",
      "status": "in_progress",
      "createdAt": "2026-02-26T10:00:00Z",
      "completedAt": null,
      "snoozedUntil": null
    }
  ]
}
```

## 🐍 Использование как Python модуль

```python
from task_manager import add_task, get_tasks, complete_task

# Добавить задачу
task = add_task("/path/to/project", "Fix bug", "Description")

# Получить все задачи
result = get_tasks("/path/to/project")
print(result['summary'])  # {'total': 5, 'pending': 2, 'in_progress': 1, ...}

# Отметить выполненной
complete_task("/path/to/project", task['id'])
```

## 📄 Лицензия

MIT License
