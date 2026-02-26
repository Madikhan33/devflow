import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ── Types ──────────────────────────────────────────────────────────────────

export type TaskStatus = "pending" | "in_progress" | "done" | "snoozed";

export interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    createdAt: string;
    completedAt?: string;
    snoozedUntil?: string;
}

export interface TasksFile {
    version: 1;
    tasks: Task[];
    lastUpdated: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const TASKS_FILENAME = ".tasks.json";

function tasksPath(dir: string): string {
    return path.join(dir, TASKS_FILENAME);
}

function now(): string {
    return new Date().toISOString();
}

function generateId(): string {
    return crypto.randomUUID().slice(0, 8);
}

// ── Core CRUD ──────────────────────────────────────────────────────────────

export function loadTasks(dir: string): TasksFile {
    const filePath = tasksPath(dir);
    if (!fs.existsSync(filePath)) {
        return { version: 1, tasks: [], lastUpdated: now() };
    }
    try {
        const raw = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(raw) as TasksFile;
    } catch {
        return { version: 1, tasks: [], lastUpdated: now() };
    }
}

export async function loadTasksFromRemote(serverUrl: string): Promise<TasksFile> {
    try {
        const url = serverUrl.replace(/\/+$/, "") + "/tasks";
        const https = await import("https");
        const http = await import("http");
        const mod = url.startsWith("https") ? https : http;

        return new Promise((resolve) => {
            const req = mod.get(url, { timeout: 5000 }, (res: any) => {
                let body = "";
                res.on("data", (chunk: string) => { body += chunk; });
                res.on("end", () => {
                    try {
                        const data = JSON.parse(body);
                        // Server returns { summary: {...}, tasks: [...] }
                        resolve({
                            version: 1,
                            tasks: data.tasks || [],
                            lastUpdated: now(),
                        });
                    } catch {
                        resolve({ version: 1, tasks: [], lastUpdated: now() });
                    }
                });
            });
            req.on("error", () => {
                resolve({ version: 1, tasks: [], lastUpdated: now() });
            });
            req.on("timeout", () => {
                req.destroy();
                resolve({ version: 1, tasks: [], lastUpdated: now() });
            });
        });
    } catch {
        return { version: 1, tasks: [], lastUpdated: now() };
    }
}

export function saveTasks(dir: string, data: TasksFile): void {
    data.lastUpdated = now();
    const filePath = tasksPath(dir);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ── Operations ─────────────────────────────────────────────────────────────

export function getTasks(
    dir: string,
    filter?: { status?: TaskStatus; date?: string }
): Task[] {
    const data = loadTasks(dir);
    let tasks = data.tasks;

    if (filter?.status) {
        tasks = tasks.filter((t) => t.status === filter.status);
    }

    if (filter?.date) {
        const targetDate = filter.date;
        tasks = tasks.filter((t) => {
            if (t.status === "snoozed" && t.snoozedUntil) {
                return t.snoozedUntil <= targetDate;
            }
            return t.createdAt.startsWith(targetDate) || t.status !== "snoozed";
        });
    }

    return tasks;
}

export function addTask(
    dir: string,
    title: string,
    description?: string
): Task {
    const data = loadTasks(dir);
    const task: Task = {
        id: generateId(),
        title,
        description,
        status: "pending",
        createdAt: now(),
    };
    data.tasks.push(task);
    saveTasks(dir, data);
    return task;
}

export function completeTask(dir: string, id: string): Task | null {
    const data = loadTasks(dir);
    const task = data.tasks.find((t) => t.id === id);
    if (!task) return null;

    task.status = "done";
    task.completedAt = now();
    saveTasks(dir, data);
    return task;
}

export function snoozeTask(
    dir: string,
    id: string,
    date: string
): Task | null {
    const data = loadTasks(dir);
    const task = data.tasks.find((t) => t.id === id);
    if (!task) return null;

    task.status = "snoozed";
    task.snoozedUntil = date;
    saveTasks(dir, data);
    return task;
}

export function startTask(dir: string, id: string): Task | null {
    const data = loadTasks(dir);
    const task = data.tasks.find((t) => t.id === id);
    if (!task) return null;

    task.status = "in_progress";
    saveTasks(dir, data);
    return task;
}

export function deleteTask(dir: string, id: string): boolean {
    const data = loadTasks(dir);
    const idx = data.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return false;

    data.tasks.splice(idx, 1);
    saveTasks(dir, data);
    return true;
}

export async function deleteTaskFromRemote(serverUrl: string, id: string): Promise<boolean> {
    try {
        const url = serverUrl.replace(/\/+$/, "") + "/tasks/" + id;
        const https = await import("https");
        const http = await import("http");
        const mod = url.startsWith("https") ? https : http;

        return new Promise((resolve) => {
            const req = mod.request(
                url,
                { method: "DELETE", timeout: 5000 },
                (res: any) => {
                    let body = "";
                    res.on("data", (chunk: string) => { body += chunk; });
                    res.on("end", () => {
                        try {
                            const data = JSON.parse(body);
                            resolve(data.success === true);
                        } catch {
                            resolve(false);
                        }
                    });
                }
            );
            req.on("error", () => {
                resolve(false);
            });
            req.on("timeout", () => {
                req.destroy();
                resolve(false);
            });
            req.end();
        });
    } catch {
        return false;
    }
}
