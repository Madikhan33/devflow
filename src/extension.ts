import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { DevFlowSidebarProvider } from "./webview/sidebarProvider";
import { addTask, loadTasks, loadTasksFromRemote, type TasksFile } from "./taskManager";

// ── Remote server URL ────────────────────────────────────────────────────
const REMOTE_SERVER_URL = "https://devflow-production-f9f0.up.railway.app";

function getServerUrl(): string | undefined {
    const configUrl = vscode.workspace.getConfiguration().get<string>("devflow.serverUrl");
    return configUrl || REMOTE_SERVER_URL;
}

export function activate(context: vscode.ExtensionContext): void {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // ── Sidebar Webview ──────────────────────────────────────────────────

    const sidebarProvider = new DevFlowSidebarProvider(
        context.extensionUri, workspaceFolder, getServerUrl()
    );
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            DevFlowSidebarProvider.viewType, sidebarProvider
        )
    );

    // ── File Watcher (обновление при изменении локального .tasks.json) ────

    let tasksFilePath: string | undefined;
    let lastTaskIds = new Set<string>();

    if (workspaceFolder) {
        tasksFilePath = path.join(workspaceFolder, ".tasks.json");
        try {
            const data = loadTasks(workspaceFolder);
            lastTaskIds = new Set(data.tasks.map(t => t.id));
        } catch {
            // ignore
        }
    }

    const onLocalFileChanged = () => {
        if (workspaceFolder) {
            try {
                const data = loadTasks(workspaceFolder);
                const currentTaskIds = new Set(data.tasks.map(t => t.id));
                const newTasks = data.tasks.filter(t => !lastTaskIds.has(t.id));

                if (newTasks.length > 0) {
                    for (const task of newTasks) {
                        vscode.window.showInformationMessage(
                            `DevFlow: AI added task — ${task.title}`
                        );
                    }
                }

                lastTaskIds = currentTaskIds;
            } catch {
                // ignore
            }
        }

        sidebarProvider.refresh();
    };

    // VS Code file watcher
    const watcher = vscode.workspace.createFileSystemWatcher("**/.tasks.json");
    watcher.onDidChange(() => onLocalFileChanged());
    watcher.onDidCreate(() => onLocalFileChanged());
    watcher.onDidDelete(() => {
        sidebarProvider.refresh();
    });
    context.subscriptions.push(watcher);

    // Node.js fs.watchFile as backup
    let fsWatcher: fs.StatWatcher | undefined;
    if (tasksFilePath) {
        if (!fs.existsSync(tasksFilePath)) {
            fs.writeFileSync(tasksFilePath, JSON.stringify({
                version: 1,
                tasks: [],
                lastUpdated: new Date().toISOString()
            }, null, 2), "utf-8");
        }

        fsWatcher = fs.watchFile(tasksFilePath, { interval: 2000 }, (curr, prev) => {
            if (curr.mtime !== prev.mtime || curr.size !== prev.size) {
                onLocalFileChanged();
            }
        });
    }

    // ── Remote polling (только проверка изменений, без лишних обновлений) ──

    let remotePollingInterval: ReturnType<typeof setInterval> | undefined;

    if (getServerUrl()) {
        // Первая загрузка при старте
        sidebarProvider.refresh();

        // Потом проверяем каждые 5 секунд
        remotePollingInterval = setInterval(() => {
            sidebarProvider.refresh();
        }, 5000);
    }

    // ── Commands ─────────────────────────────────────────────────────────

    context.subscriptions.push(
        vscode.commands.registerCommand("devflow.refresh", () => {
            sidebarProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("devflow.addTask", async () => {
            const dir =
                workspaceFolder || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!dir) {
                vscode.window.showErrorMessage(
                    "DevFlow: Open a workspace folder first."
                );
                return;
            }

            const title = await vscode.window.showInputBox({
                prompt: "Task title",
                placeHolder: "e.g. Fix build warnings",
            });
            if (!title) return;

            const task = addTask(dir, title);
            lastTaskIds.add(task.id);
            sidebarProvider.refresh();
            vscode.window.showInformationMessage(`DevFlow: Task added — ${title}`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("devflow.setServerUrl", async () => {
            const currentUrl = getServerUrl() || "";
            const url = await vscode.window.showInputBox({
                prompt: "Enter DevFlow server URL (Railway)",
                placeHolder: "https://devflow-production-xxxx.up.railway.app",
                value: currentUrl,
            });
            if (url !== undefined) {
                await vscode.workspace.getConfiguration().update(
                    "devflow.serverUrl", url || undefined, vscode.ConfigurationTarget.Global
                );
                sidebarProvider.setServerUrl(url || undefined);
                sidebarProvider.refresh();
                if (url) {
                    vscode.window.showInformationMessage(`DevFlow: Connected to ${url}`);
                } else {
                    vscode.window.showInformationMessage("DevFlow: Disconnected from remote server");
                }
            }
        })
    );

    // ── Status Bar ───────────────────────────────────────────────────────

    const statusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBar.command = "devflow.refresh";
    const serverUrl = getServerUrl();
    statusBar.text = serverUrl ? "$(tasklist) DevFlow 🌐" : "$(tasklist) DevFlow";
    statusBar.tooltip = "DevFlow Tasks";
    statusBar.show();
    context.subscriptions.push(statusBar);

    // ── Cleanup ──────────────────────────────────────────────────────────

    context.subscriptions.push({
        dispose: () => {
            if (remotePollingInterval) {
                clearInterval(remotePollingInterval);
            }
            if (fsWatcher) {
                fs.unwatchFile(tasksFilePath || "");
            }
        },
    });
}

export function deactivate(): void {
    // cleanup handled by disposables
}
