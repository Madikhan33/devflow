import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { TaskTreeProvider } from "./taskTreeProvider";
import { DevFlowPanel } from "./webview/panel";
import { addTask, loadTasks, loadTasksFromRemote, type TasksFile } from "./taskManager";

// ── Remote server URL config key ─────────────────────────────────────────
const CONFIG_KEY = "devflow.serverUrl";

function getServerUrl(): string | undefined {
    return vscode.workspace.getConfiguration().get<string>(CONFIG_KEY);
}

export function activate(context: vscode.ExtensionContext): void {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // ── Tree View ────────────────────────────────────────────────────────

    const treeProvider = new TaskTreeProvider(workspaceFolder, getServerUrl());
    const treeView = vscode.window.createTreeView("devflow.tasks", {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    // ── File Watcher (для локальных задач) ────────────────────────────────

    let tasksFilePath: string | undefined;
    let lastTaskCount = 0;
    let lastTaskIds = new Set<string>();

    if (workspaceFolder) {
        tasksFilePath = path.join(workspaceFolder, ".tasks.json");
        try {
            const data = loadTasks(workspaceFolder);
            lastTaskCount = data.tasks.length;
            lastTaskIds = new Set(data.tasks.map(t => t.id));
        } catch {
            // ignore
        }
    }

    const onTasksFileChanged = (source: string) => {
        if (workspaceFolder) {
            try {
                const data = loadTasks(workspaceFolder);
                const currentTaskIds = new Set(data.tasks.map(t => t.id));

                const newTasks = data.tasks.filter(t => !lastTaskIds.has(t.id));

                if (newTasks.length > 0 && source === "external") {
                    for (const task of newTasks) {
                        vscode.window.showInformationMessage(
                            `DevFlow: AI added task — ${task.title}`
                        );
                    }
                }

                lastTaskCount = data.tasks.length;
                lastTaskIds = currentTaskIds;
            } catch {
                // ignore read errors
            }
        }

        treeProvider.refresh();
        DevFlowPanel.currentPanel?.update();
    };

    const watcher = vscode.workspace.createFileSystemWatcher("**/.tasks.json");
    watcher.onDidChange(() => onTasksFileChanged("external"));
    watcher.onDidCreate(() => onTasksFileChanged("external"));
    watcher.onDidDelete(() => {
        treeProvider.refresh();
        DevFlowPanel.currentPanel?.update();
    });
    context.subscriptions.push(watcher);

    let fsWatcher: fs.StatWatcher | undefined;
    if (tasksFilePath) {
        if (!fs.existsSync(tasksFilePath)) {
            fs.writeFileSync(tasksFilePath, JSON.stringify({
                version: 1,
                tasks: [],
                lastUpdated: new Date().toISOString()
            }, null, 2), "utf-8");
        }

        fsWatcher = fs.watchFile(tasksFilePath, { interval: 1000 }, (curr, prev) => {
            if (curr.mtime !== prev.mtime || curr.size !== prev.size) {
                onTasksFileChanged("external");
            }
        });
    }

    // ── Commands ─────────────────────────────────────────────────────────

    context.subscriptions.push(
        vscode.commands.registerCommand("devflow.refresh", () => {
            treeProvider.refresh();
            DevFlowPanel.currentPanel?.update();
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
            lastTaskCount++;
            treeProvider.refresh();
            DevFlowPanel.currentPanel?.update();
            vscode.window.showInformationMessage(`DevFlow: Task added — ${title}`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("devflow.openPanel", () => {
            DevFlowPanel.createOrShow(context.extensionUri, workspaceFolder, getServerUrl());
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
                    CONFIG_KEY, url || undefined, vscode.ConfigurationTarget.Global
                );
                treeProvider.setServerUrl(url || undefined);
                treeProvider.refresh();
                DevFlowPanel.currentPanel?.update();
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
    statusBar.command = "devflow.openPanel";
    const serverUrl = getServerUrl();
    statusBar.text = serverUrl ? "$(tasklist) DevFlow 🌐" : "$(tasklist) DevFlow";
    statusBar.tooltip = serverUrl
        ? `DevFlow — Connected to ${serverUrl}`
        : "Open DevFlow Task Panel";
    statusBar.show();
    context.subscriptions.push(statusBar);

    // ── Auto-refresh (поллинг для локальных + удалённых задач) ────────────

    const refreshInterval = setInterval(() => {
        treeProvider.refresh();
        DevFlowPanel.currentPanel?.update();
    }, 3000);

    context.subscriptions.push({
        dispose: () => {
            clearInterval(refreshInterval);
            if (fsWatcher) {
                fs.unwatchFile(tasksFilePath || "");
            }
        },
    });
}

export function deactivate(): void {
    // cleanup handled by disposables
}
