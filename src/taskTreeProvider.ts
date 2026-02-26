import * as vscode from "vscode";
import { loadTasks, type Task, type TaskStatus } from "./taskManager";

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
        collapsible: vscode.TreeItemCollapsibleState
    ) {
        super(task.title, collapsible);

        this.id = task.id;
        this.description = task.description || "";
        this.tooltip = this.buildTooltip();
        this.iconPath = new vscode.ThemeIcon(STATUS_ICONS[task.status]);
        this.contextValue = `task-${task.status}`;
    }

    private buildTooltip(): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${this.task.title}**\n\n`);
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

    private tasks: Task[] = [];

    constructor(private workDir?: string) {
        this.loadData();
    }

    refresh(): void {
        this.loadData();
        this._onDidChangeTreeData.fire();
    }

    private loadData(): void {
        const dir =
            this.workDir ||
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!dir) {
            this.tasks = [];
            return;
        }
        try {
            const data = loadTasks(dir);
            this.tasks = data.tasks;
        } catch {
            this.tasks = [];
        }
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
                    (t) => new TaskTreeItem(t, vscode.TreeItemCollapsibleState.None)
                );
        }

        return [];
    }
}
