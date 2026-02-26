# Публикация в Smithery

## Шаг 1: Подготовка

Убедись, что у тебя есть:
- [ ] Аккаунт на [smithery.ai](https://smithery.ai)
- [ ] Код выложен на GitHub
- [ ] Файл `smithery.yaml` в корне MCP сервера
- [ ] README.md с описанием

## Шаг 2: Установка Smithery CLI

```bash
npm install -g @smithery/cli
```

## Шаг 3: Логин

```bash
smithery login
```

## Шаг 4: Публикация

```bash
# Из папки mcp-server
smithery publish
```

Или с указанием пути:
```bash
smithery publish --path ./mcp-server
```

## Шаг 5: Проверка

После публикации сервер будет доступен по адресу:
`https://smithery.ai/server/@madik/devflow`

## Установка пользователями

После публикации пользователи смогут установить одной командой:

```bash
# Для Cursor
npx -y @smithery/cli install @madik/devflow --client cursor

# Для Claude Desktop
npx -y @smithery/cli install @madik/devflow --client claude

# Для VS Code
npx -y @smithery/cli install @madik/devflow --client vscode
```

## Обновление версии

1. Измени версию в `smithery.yaml` и `package.json`
2. Сделай commit и push
3. Запусти `smithery publish` снова
