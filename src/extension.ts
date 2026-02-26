import * as vscode from "vscode";
import { TaskTreeProvider } from "./taskTreeProvider";
import { DevFlowPanel } from "./webview/panel";
import { addTask } from "./taskManager";

export function activate(context: vscode.ExtensionContext): void {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // ── Tree View ────────────────────────────────────────────────────────

    const treeProvider = new TaskTreeProvider(workspaceFolder);
    const treeView = vscode.window.createTreeView("devflow.tasks", {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    // ── File Watcher ─────────────────────────────────────────────────────

    const watcher = vscode.workspace.createFileSystemWatcher("**/.tasks.json");
    watcher.onDidChange(() => {
        treeProvider.refresh();
        DevFlowPanel.currentPanel?.update();
    });
    watcher.onDidCreate(() => {
        treeProvider.refresh();
        DevFlowPanel.currentPanel?.update();
    });
    watcher.onDidDelete(() => {
        treeProvider.refresh();
        DevFlowPanel.currentPanel?.update();
    });
    context.subscriptions.push(watcher);

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

            addTask(dir, title);
            treeProvider.refresh();
            DevFlowPanel.currentPanel?.update();
            vscode.window.showInformationMessage(`DevFlow: Task added — ${title}`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("devflow.openPanel", () => {
            DevFlowPanel.createOrShow(context.extensionUri, workspaceFolder);
        })
    );

    // ── Status Bar ───────────────────────────────────────────────────────

    const statusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBar.command = "devflow.openPanel";
    statusBar.text = "$(tasklist) DevFlow";
    statusBar.tooltip = "Open DevFlow Task Panel";
    statusBar.show();
    context.subscriptions.push(statusBar);

    // ── Auto-refresh on interval (for snoozed tasks becoming active) ────

    const refreshInterval = setInterval(() => {
        treeProvider.refresh();
        DevFlowPanel.currentPanel?.update();
    }, 5000);

    context.subscriptions.push({
        dispose: () => clearInterval(refreshInterval),
    });
}

export function deactivate(): void {
    // cleanup handled by disposables
}
