import * as vscode from "vscode";
import { loadTasks, loadTasksFromRemote, type Task, type TaskStatus, type TasksFile } from "./taskManager";

// ── Icons per status ─────────────────────────────────────────────────────

const STATUS_ICONS: Record<TaskStatus, string> = {
    pending: "circle-outline",
    in_progress: "loading~spin",
    done: "check",
    snoozed: "clock",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
    pending: "Pending",
    in_progress: "In Progress",
    done: "Done",
    snoozed: "Snoozed",
};

// ── Tree Item ────────────────────────────────────────────────────────────

class TaskTreeItem extends vscode.TreeItem {
    constructor(
        public readonly task: Task,
        collapsible: vscode.TreeItemCollapsibleState,
        public readonly isRemote: boolean = false
    ) {
        super(task.title, collapsible);

        this.id = (isRemote ? "remote-" : "local-") + task.id;
        this.description = isRemote ? `🌐 ${task.description || ""}` : (task.description || "");
        this.tooltip = this.buildTooltip();
        this.iconPath = new vscode.ThemeIcon(STATUS_ICONS[task.status]);
        this.contextValue = `task-${task.status}`;
    }

    private buildTooltip(): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${this.task.title}**\n\n`);
        if (this.isRemote) {
            md.appendMarkdown(`🌐 *Remote task (Railway)*\n\n`);
        }
        if (this.task.description) {
            md.appendMarkdown(`${this.task.description}\n\n`);
        }
        md.appendMarkdown(`Status: \`${STATUS_LABELS[this.task.status]}\`\n\n`);
        md.appendMarkdown(
            `Created: ${new Date(this.task.createdAt).toLocaleString()}\n\n`
        );
        if (this.task.completedAt) {
            md.appendMarkdown(
                `Completed: ${new Date(this.task.completedAt).toLocaleString()}\n\n`
            );
        }
        if (this.task.snoozedUntil) {
            md.appendMarkdown(`Snoozed until: ${this.task.snoozedUntil}\n\n`);
        }
        return md;
    }
}

class StatusGroupItem extends vscode.TreeItem {
    constructor(
        public readonly status: TaskStatus,
        public readonly count: number
    ) {
        super(
            `${STATUS_LABELS[status]} (${count})`,
            count > 0
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed
        );
        this.iconPath = new vscode.ThemeIcon(STATUS_ICONS[status]);
        this.contextValue = "status-group";
    }
}

// ── Tree Data Provider ───────────────────────────────────────────────────

export class TaskTreeProvider
    implements vscode.TreeDataProvider<TaskTreeItem | StatusGroupItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private tasks: (Task & { _remote?: boolean })[] = [];
    private serverUrl?: string;

    constructor(private workDir?: string, serverUrl?: string) {
        this.serverUrl = serverUrl;
        this.loadData();
    }

    setServerUrl(url?: string): void {
        this.serverUrl = url;
    }

    refresh(): void {
        this.loadData();
        this._onDidChangeTreeData.fire();
    }

    private loadData(): void {
        const dir =
            this.workDir ||
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        // Load local tasks
        let localTasks: Task[] = [];
        if (dir) {
            try {
                const data = loadTasks(dir);
                localTasks = data.tasks;
            } catch {
                // ignore
            }
        }

        // Load remote tasks (async, will trigger a second refresh)
        if (this.serverUrl) {
            loadTasksFromRemote(this.serverUrl).then((remoteData) => {
                const remoteTasks = remoteData.tasks.map(t => ({ ...t, _remote: true }));
                const localIds = new Set(localTasks.map(t => t.id));
                // Merge: remote tasks that don't exist locally
                const uniqueRemote = remoteTasks.filter(t => !localIds.has(t.id));
                this.tasks = [...localTasks, ...uniqueRemote];
                this._onDidChangeTreeData.fire();
            }).catch(() => {
                // On error, just use local tasks
                this.tasks = localTasks;
                this._onDidChangeTreeData.fire();
            });
        }

        // Immediately show local tasks (remote will arrive later)
        this.tasks = localTasks;
    }

    getTreeItem(element: TaskTreeItem | StatusGroupItem): vscode.TreeItem {
        return element;
    }

    getChildren(
        element?: TaskTreeItem | StatusGroupItem
    ): (TaskTreeItem | StatusGroupItem)[] {
        if (!element) {
            // Root: show status groups
            const statuses: TaskStatus[] = [
                "in_progress",
                "pending",
                "snoozed",
                "done",
            ];
            return statuses
                .map((s) => {
                    const count = this.tasks.filter((t) => t.status === s).length;
                    return new StatusGroupItem(s, count);
                })
                .filter((g) => g.count > 0);
        }

        if (element instanceof StatusGroupItem) {
            return this.tasks
                .filter((t) => t.status === element.status)
                .map(
                    (t) => new TaskTreeItem(t, vscode.TreeItemCollapsibleState.None, !!(t as any)._remote)
                );
        }

        return [];
    }
}
