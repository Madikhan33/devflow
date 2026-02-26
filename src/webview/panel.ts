import * as vscode from "vscode";
import { loadTasks, loadTasksFromRemote, deleteTask } from "../taskManager";

export class DevFlowPanel {
  public static currentPanel: DevFlowPanel | undefined;
  private static readonly viewType = "devflow.panel";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _workDir?: string;
  private readonly _serverUrl?: string;
  private _disposed = false;

  public static createOrShow(
    extensionUri: vscode.Uri,
    workDir?: string,
    serverUrl?: string
  ): void {
    const column = vscode.ViewColumn.Beside;

    if (DevFlowPanel.currentPanel) {
      DevFlowPanel.currentPanel._panel.reveal(column);
      DevFlowPanel.currentPanel.update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      DevFlowPanel.viewType,
      "DevFlow Tasks",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "src", "webview", "ui")],
      }
    );

    DevFlowPanel.currentPanel = new DevFlowPanel(panel, extensionUri, workDir, serverUrl);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    workDir?: string,
    serverUrl?: string
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._workDir = workDir;
    this._serverUrl = serverUrl;

    this._panel.webview.html = this._getHtml();
    this.update();

    this._panel.onDidDispose(() => {
      this._disposed = true;
      DevFlowPanel.currentPanel = undefined;
    });

    // Handle messages from the webview (e.g. delete task)
    this._panel.webview.onDidReceiveMessage((message) => {
      if (message.type === 'deleteTask' && message.taskId) {
        const dir = this._workDir || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (dir) {
          const deleted = deleteTask(dir, message.taskId);
          if (deleted) {
            vscode.window.showInformationMessage(`DevFlow: Задача удалена`);
          }
          this.update();
        }
      }
    });
  }

  public update(): void {
    if (this._disposed) return;

    const dir =
      this._workDir ||
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // Load local tasks
    let localTasks: any[] = [];
    let lastUpdated = new Date().toISOString();
    if (dir) {
      try {
        const data = loadTasks(dir);
        localTasks = data.tasks;
        lastUpdated = data.lastUpdated;
      } catch {
        // ignore
      }
    }

    // If server URL configured, merge remote tasks
    if (this._serverUrl) {
      loadTasksFromRemote(this._serverUrl).then((remoteData) => {
        const localIds = new Set(localTasks.map(t => t.id));
        const uniqueRemote = remoteData.tasks.filter(t => !localIds.has(t.id));
        const merged = [...localTasks, ...uniqueRemote];
        this._panel.webview.postMessage({
          type: "update",
          tasks: merged,
          lastUpdated,
        });
      }).catch(() => {
        this._panel.webview.postMessage({
          type: "update",
          tasks: localTasks,
          lastUpdated,
        });
      });
    } else {
      this._panel.webview.postMessage({
        type: "update",
        tasks: localTasks,
        lastUpdated,
      });
    }
  }

  private _getHtml(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DevFlow Tasks</title>
  <style>
    /* ═══════════════════════════════════════════════════════════════
       DESIGN SYSTEM
       ═══════════════════════════════════════════════════════════════ */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    :root {
      --bg-primary: #0a0e17;
      --bg-secondary: #111827;
      --bg-card: rgba(17, 24, 39, 0.7);
      --bg-card-hover: rgba(30, 41, 59, 0.8);
      --bg-glass: rgba(255, 255, 255, 0.03);
      --bg-glass-hover: rgba(255, 255, 255, 0.06);
      --border: rgba(255, 255, 255, 0.06);
      --border-hover: rgba(255, 255, 255, 0.12);
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent-blue: #60a5fa;
      --accent-cyan: #22d3ee;
      --accent-green: #34d399;
      --accent-emerald: #10b981;
      --accent-orange: #fbbf24;
      --accent-amber: #f59e0b;
      --accent-purple: #a78bfa;
      --accent-violet: #8b5cf6;
      --accent-red: #f87171;
      --accent-rose: #fb7185;
      --accent-pink: #f472b6;
      --glow-blue: rgba(96, 165, 250, 0.2);
      --glow-green: rgba(52, 211, 153, 0.2);
      --glow-orange: rgba(251, 191, 36, 0.2);
      --glow-purple: rgba(167, 139, 250, 0.2);
      --glow-cyan: rgba(34, 211, 238, 0.15);
      --radius: 16px;
      --radius-sm: 10px;
      --radius-xs: 6px;
      --transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      --transition-fast: 0.15s ease;
      --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.3);
      --shadow-glow: 0 0 40px rgba(96, 165, 250, 0.08);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 0;
      overflow-x: hidden;
      min-height: 100vh;
    }

    /* ── Animated Background ─────────────────────────── */
    .bg-pattern {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    }
    .bg-pattern::before {
      content: '';
      position: absolute;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(96,165,250,0.08) 0%, transparent 70%);
      top: -200px;
      right: -200px;
      animation: floatBg 20s ease-in-out infinite;
    }
    .bg-pattern::after {
      content: '';
      position: absolute;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 70%);
      bottom: -150px;
      left: -200px;
      animation: floatBg 25s ease-in-out infinite reverse;
    }
    @keyframes floatBg {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(30px, -20px) scale(1.05); }
      66% { transform: translate(-20px, 20px) scale(0.95); }
    }

    .app-container {
      position: relative;
      z-index: 1;
      max-width: 680px;
      margin: 0 auto;
      padding: 24px 20px;
    }

    /* ═══════════════════════════════════════════════════════════════
       HEADER
       ═══════════════════════════════════════════════════════════════ */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .logo-icon {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-violet));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: 0 4px 16px rgba(96, 165, 250, 0.25);
      animation: logoPulse 3s ease-in-out infinite;
    }

    @keyframes logoPulse {
      0%, 100% { box-shadow: 0 4px 16px rgba(96, 165, 250, 0.25); }
      50% { box-shadow: 0 4px 24px rgba(96, 165, 250, 0.4); }
    }

    .header-title h1 {
      font-size: 24px;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.5px;
      line-height: 1.2;
    }

    .header-title .subtitle {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 500;
      letter-spacing: 0.5px;
    }

    .header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .last-updated {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 500;
    }

    .connection-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      background: rgba(52, 211, 153, 0.1);
      color: var(--accent-green);
      border: 1px solid rgba(52, 211, 153, 0.2);
    }

    .connection-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent-green);
      animation: blink 2s ease-in-out infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* ═══════════════════════════════════════════════════════════════
       STATS GRID
       ═══════════════════════════════════════════════════════════════ */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--bg-glass);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 16px 12px;
      text-align: center;
      transition: var(--transition);
      position: relative;
      overflow: hidden;
      cursor: default;
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      transition: height var(--transition);
    }

    .stat-card:hover::before { height: 3px; }
    .stat-card:hover {
      transform: translateY(-3px);
      border-color: var(--border-hover);
      box-shadow: var(--shadow-card);
    }

    .stat-card.in_progress::before { background: linear-gradient(90deg, var(--accent-blue), var(--accent-cyan)); }
    .stat-card.pending::before    { background: linear-gradient(90deg, var(--accent-orange), var(--accent-amber)); }
    .stat-card.done::before       { background: linear-gradient(90deg, var(--accent-green), var(--accent-emerald)); }
    .stat-card.snoozed::before    { background: linear-gradient(90deg, var(--accent-purple), var(--accent-violet)); }

    .stat-card:hover.in_progress { box-shadow: 0 8px 32px rgba(96,165,250,0.15); }
    .stat-card:hover.pending     { box-shadow: 0 8px 32px rgba(251,191,36,0.15); }
    .stat-card:hover.done        { box-shadow: 0 8px 32px rgba(52,211,153,0.15); }
    .stat-card:hover.snoozed     { box-shadow: 0 8px 32px rgba(167,139,250,0.15); }

    .stat-emoji {
      font-size: 20px;
      margin-bottom: 6px;
      display: block;
    }

    .stat-number {
      font-size: 26px;
      font-weight: 800;
      display: block;
      line-height: 1;
    }

    .stat-card.in_progress .stat-number { color: var(--accent-blue); }
    .stat-card.pending     .stat-number { color: var(--accent-orange); }
    .stat-card.done        .stat-number { color: var(--accent-green); }
    .stat-card.snoozed     .stat-number { color: var(--accent-purple); }

    .stat-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    /* ═══════════════════════════════════════════════════════════════
       PROGRESS BAR
       ═══════════════════════════════════════════════════════════════ */
    .progress-container {
      margin-bottom: 28px;
      background: var(--bg-glass);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 16px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .progress-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .progress-pct {
      font-size: 13px;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent-green), var(--accent-cyan));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .progress-bar-track {
      height: 8px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    }

    .progress-bar-fill {
      height: 100%;
      border-radius: 4px;
      background: linear-gradient(90deg, var(--accent-green), var(--accent-cyan));
      transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    .progress-bar-fill::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      animation: shimmer 2.5s infinite;
    }

    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    /* ═══════════════════════════════════════════════════════════════
       TAB NAVIGATION — Today / Yesterday / All
       ═══════════════════════════════════════════════════════════════ */
    .tab-nav {
      display: flex;
      gap: 4px;
      margin-bottom: 20px;
      background: var(--bg-glass);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 4px;
    }

    .tab-btn {
      flex: 1;
      padding: 10px 12px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: var(--transition);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      position: relative;
    }

    .tab-btn:hover {
      color: var(--text-secondary);
      background: rgba(255, 255, 255, 0.04);
    }

    .tab-btn.active {
      color: var(--text-primary);
      background: rgba(96, 165, 250, 0.12);
      box-shadow: 0 2px 8px rgba(96, 165, 250, 0.1);
    }

    .tab-badge {
      background: rgba(96, 165, 250, 0.2);
      color: var(--accent-blue);
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 10px;
      min-width: 18px;
      text-align: center;
    }

    .tab-btn.active .tab-badge {
      background: rgba(96, 165, 250, 0.3);
    }

    /* ═══════════════════════════════════════════════════════════════
       DATE SECTION HEADER
       ═══════════════════════════════════════════════════════════════ */
    .date-section {
      margin-bottom: 24px;
      animation: fadeInUp 0.4s ease-out forwards;
    }

    .date-section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      padding: 10px 14px;
      background: linear-gradient(135deg, rgba(96,165,250,0.06), rgba(167,139,250,0.04));
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }

    .date-section-header.yesterday {
      background: linear-gradient(135deg, rgba(251,191,36,0.06), rgba(245,158,11,0.04));
    }

    .date-section-header.older {
      background: linear-gradient(135deg, rgba(100,116,139,0.06), rgba(71,85,105,0.04));
    }

    .date-icon {
      font-size: 22px;
    }

    .date-info {
      flex: 1;
    }

    .date-label {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .date-sublabel {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 500;
    }

    .date-count {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 20px;
      background: rgba(96, 165, 250, 0.12);
      color: var(--accent-blue);
    }

    .date-section-header.yesterday .date-count {
      background: rgba(251, 191, 36, 0.12);
      color: var(--accent-orange);
    }

    /* ═══════════════════════════════════════════════════════════════
       STATUS GROUP HEADER
       ═══════════════════════════════════════════════════════════════ */
    .status-group {
      margin-bottom: 16px;
    }

    .status-group-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
      padding-left: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* ═══════════════════════════════════════════════════════════════
       TASK CARDS
       ═══════════════════════════════════════════════════════════════ */
    .task-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 8px;
    }

    .task-card {
      background: var(--bg-glass);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 14px 16px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      transition: var(--transition);
      animation: slideIn 0.35s ease-out forwards;
      opacity: 0;
      transform: translateY(8px);
      cursor: default;
      position: relative;
      overflow: hidden;
    }

    .task-card::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      border-radius: 0 3px 3px 0;
      transition: var(--transition);
    }

    .task-card:hover {
      background: var(--bg-glass-hover);
      border-color: var(--border-hover);
      transform: translateX(4px);
    }

    @keyframes slideIn {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Status variants */
    .task-card.in_progress::before { background: linear-gradient(180deg, var(--accent-blue), var(--accent-cyan)); }
    .task-card.in_progress { box-shadow: inset 0 0 30px rgba(96, 165, 250, 0.04); }
    .task-card.in_progress:hover { box-shadow: 0 4px 20px rgba(96, 165, 250, 0.1); }

    .task-card.pending::before { background: linear-gradient(180deg, var(--accent-orange), var(--accent-amber)); }

    .task-card.done::before { background: linear-gradient(180deg, var(--accent-green), var(--accent-emerald)); }
    .task-card.done { opacity: 0.65; }
    .task-card.done:hover { opacity: 0.85; }

    .task-card.snoozed::before { background: linear-gradient(180deg, var(--accent-purple), var(--accent-violet)); }
    .task-card.snoozed { opacity: 0.7; }

    .task-card.carried-over {
      border-color: rgba(251, 191, 36, 0.15);
    }
    .task-card.carried-over::after {
      content: '⏎';
      position: absolute;
      top: 8px;
      right: 10px;
      font-size: 12px;
      opacity: 0.5;
    }

    .task-status-icon {
      font-size: 18px;
      flex-shrink: 0;
      margin-top: 1px;
      width: 24px;
      text-align: center;
    }

    .task-content {
      flex: 1;
      min-width: 0;
    }

    .task-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      word-break: break-word;
      line-height: 1.4;
    }

    .task-card.done .task-title {
      text-decoration: line-through;
      color: var(--text-muted);
    }

    .task-description {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 3px;
      line-height: 1.4;
      opacity: 0.9;
    }

    .task-meta {
      display: flex;
      gap: 10px;
      margin-top: 6px;
      font-size: 11px;
      color: var(--text-muted);
      align-items: center;
      flex-wrap: wrap;
    }

    .task-id {
      font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
      color: var(--accent-blue);
      opacity: 0.6;
      font-size: 10px;
      font-weight: 600;
    }

    .task-time {
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .carry-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 7px;
      border-radius: 8px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: rgba(251, 191, 36, 0.12);
      color: var(--accent-orange);
      border: 1px solid rgba(251, 191, 36, 0.15);
    }

    /* ── Pulse animation ─────────────────────────────── */
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.95); }
    }
    .pulse { animation: pulse 2s ease-in-out infinite; }

    /* ═══════════════════════════════════════════════════════════════
       ANIMATED MASCOT — Buddy the Robot 🤖
       ═══════════════════════════════════════════════════════════════ */
    .mascot-container {
      position: relative;
      margin-bottom: 24px;
      animation: fadeInUp 0.6s ease-out;
    }

    .mascot-card {
      background: linear-gradient(135deg, rgba(96,165,250,0.08), rgba(167,139,250,0.06));
      border: 1px solid rgba(96, 165, 250, 0.12);
      border-radius: var(--radius);
      padding: 18px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      position: relative;
      overflow: hidden;
      transition: var(--transition);
    }

    .mascot-card:hover {
      border-color: rgba(96, 165, 250, 0.2);
      box-shadow: 0 4px 24px rgba(96, 165, 250, 0.08);
    }

    .mascot-card::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 200px;
      height: 200px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(96,165,250,0.06) 0%, transparent 70%);
      pointer-events: none;
    }

    /* Robot Character — Pure CSS */
    .mascot-avatar {
      width: 64px;
      height: 64px;
      flex-shrink: 0;
      position: relative;
      animation: mascotFloat 3s ease-in-out infinite;
    }

    @keyframes mascotFloat {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-5px); }
    }

    /* Robot head */
    .robot-head {
      width: 48px;
      height: 38px;
      background: linear-gradient(180deg, #6366f1, #4f46e5);
      border-radius: 12px 12px 8px 8px;
      position: absolute;
      left: 8px;
      top: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .robot-head::before {
      content: '';
      position: absolute;
      top: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      height: 8px;
      background: #818cf8;
      border-radius: 2px 2px 0 0;
    }

    .robot-head::after {
      content: '';
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      width: 8px;
      height: 8px;
      background: var(--accent-cyan);
      border-radius: 50%;
      animation: antennaPulse 2s ease-in-out infinite;
      box-shadow: 0 0 8px rgba(34, 211, 238, 0.5);
    }

    @keyframes antennaPulse {
      0%, 100% { background: var(--accent-cyan); box-shadow: 0 0 8px rgba(34,211,238,0.5); }
      50% { background: var(--accent-green); box-shadow: 0 0 12px rgba(52,211,153,0.6); }
    }

    .robot-eye {
      width: 10px;
      height: 10px;
      background: #e0e7ff;
      border-radius: 50%;
      position: relative;
      animation: eyeBlink 4s ease-in-out infinite;
    }

    .robot-eye::after {
      content: '';
      position: absolute;
      width: 5px;
      height: 5px;
      background: #312e81;
      border-radius: 50%;
      top: 3px;
      left: 3px;
      animation: eyeMove 5s ease-in-out infinite;
    }

    @keyframes eyeBlink {
      0%, 45%, 55%, 100% { transform: scaleY(1); }
      50% { transform: scaleY(0.1); }
    }

    @keyframes eyeMove {
      0%, 100% { transform: translate(0, 0); }
      20% { transform: translate(2px, 0); }
      40% { transform: translate(-1px, 1px); }
      60% { transform: translate(1px, -1px); }
      80% { transform: translate(-2px, 0); }
    }

    /* Robot mouth */
    .robot-mouth {
      width: 14px;
      height: 5px;
      background: #c7d2fe;
      border-radius: 0 0 6px 6px;
      position: absolute;
      bottom: 6px;
      left: 50%;
      transform: translateX(-50%);
      animation: mouthTalk 3s ease-in-out infinite;
    }

    @keyframes mouthTalk {
      0%, 40%, 100% { height: 5px; border-radius: 0 0 6px 6px; }
      20% { height: 8px; border-radius: 0 0 8px 8px; }
      50%, 70% { height: 3px; border-radius: 0 0 4px 4px; }
      60% { height: 7px; border-radius: 0 0 7px 7px; }
    }

    /* Robot body */
    .robot-body {
      width: 40px;
      height: 18px;
      background: linear-gradient(180deg, #4f46e5, #4338ca);
      border-radius: 6px;
      position: absolute;
      left: 12px;
      top: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .robot-body::before {
      content: '';
      width: 12px;
      height: 4px;
      background: var(--accent-cyan);
      border-radius: 2px;
      animation: bodyLight 2s ease-in-out infinite;
    }

    @keyframes bodyLight {
      0%, 100% { background: var(--accent-cyan); width: 12px; }
      50% { background: var(--accent-green); width: 16px; }
    }

    /* Robot arms */
    .robot-arm {
      width: 6px;
      height: 14px;
      background: #6366f1;
      border-radius: 3px;
      position: absolute;
      top: 46px;
    }

    .robot-arm.left {
      left: 4px;
      animation: armWave 2.5s ease-in-out infinite;
      transform-origin: top center;
    }

    .robot-arm.right {
      right: 4px;
      animation: armWave 2.5s ease-in-out infinite 0.3s;
      transform-origin: top center;
    }

    @keyframes armWave {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-8deg); }
      75% { transform: rotate(8deg); }
    }

    /* Mascot Speech */
    .mascot-speech {
      flex: 1;
      position: relative;
    }

    .mascot-message {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.5;
      font-weight: 500;
    }

    .mascot-message strong {
      color: var(--text-primary);
      font-weight: 700;
    }

    .mascot-message .highlight {
      color: var(--accent-cyan);
      font-weight: 600;
    }

    .mascot-name {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--accent-violet);
      margin-bottom: 4px;
    }

    .mascot-dismiss {
      position: absolute;
      top: 12px;
      right: 12px;
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 14px;
      opacity: 0.5;
      transition: var(--transition-fast);
      padding: 4px;
      border-radius: 4px;
    }
    .mascot-dismiss:hover {
      opacity: 1;
      background: rgba(255,255,255,0.05);
    }

    /* ═══════════════════════════════════════════════════════════════
       EMPTY STATE
       ═══════════════════════════════════════════════════════════════ */
    .empty-state {
      text-align: center;
      padding: 48px 20px;
      animation: fadeInUp 0.5s ease-out;
    }

    .empty-illustration {
      font-size: 56px;
      margin-bottom: 16px;
      animation: emptyFloat 3s ease-in-out infinite;
    }

    @keyframes emptyFloat {
      0%, 100% { transform: translateY(0) rotate(0); }
      50% { transform: translateY(-8px) rotate(3deg); }
    }

    .empty-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    .empty-desc {
      font-size: 13px;
      color: var(--text-muted);
      max-width: 320px;
      margin: 0 auto;
      line-height: 1.6;
    }

    /* ═══════════════════════════════════════════════════════════════
       DELETE BUTTON
       ═══════════════════════════════════════════════════════════════ */
    .task-actions {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      opacity: 0;
      transition: opacity var(--transition-fast);
    }

    .task-card:hover .task-actions {
      opacity: 1;
    }

    .btn-delete {
      background: none;
      border: 1px solid transparent;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 14px;
      padding: 6px 8px;
      border-radius: var(--radius-xs);
      transition: var(--transition-fast);
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    .btn-delete:hover {
      color: var(--accent-red);
      background: rgba(248, 113, 113, 0.1);
      border-color: rgba(248, 113, 113, 0.2);
    }

    .btn-delete:active {
      transform: scale(0.9);
    }

    /* Delete animation */
    @keyframes taskDelete {
      0% { opacity: 1; transform: translateX(0); max-height: 100px; }
      50% { opacity: 0.3; transform: translateX(20px); }
      100% { opacity: 0; transform: translateX(40px); max-height: 0; padding: 0; margin: 0; border: 0; overflow: hidden; }
    }

    .task-card.deleting {
      animation: taskDelete 0.4s ease-out forwards;
      pointer-events: none;
    }

    /* ═══════════════════════════════════════════════════════════════
       SCROLLBAR
       ═══════════════════════════════════════════════════════════════ */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.08);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.15); }

    /* ═══════════════════════════════════════════════════════════════
       RESPONSIVE
       ═══════════════════════════════════════════════════════════════ */
    @media (max-width: 500px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .tab-btn { font-size: 12px; padding: 8px 6px; }
    }
  </style>
</head>
<body>
  <div class="bg-pattern"></div>

  <div class="app-container">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div class="logo-icon">⚡</div>
        <div class="header-title">
          <h1>DevFlow</h1>
          <div class="subtitle">AI Task Intelligence</div>
        </div>
      </div>
      <div class="header-right">
        <span class="last-updated" id="lastUpdated">—</span>
        <div class="connection-badge" id="connectionBadge">
          <span class="connection-dot"></span>
          <span>Connected</span>
        </div>
      </div>
    </div>

    <!-- Animated Mascot -->
    <div class="mascot-container" id="mascotContainer">
      <div class="mascot-card">
        <div class="mascot-avatar">
          <div class="robot-head">
            <div class="robot-eye"></div>
            <div class="robot-eye"></div>
            <div class="robot-mouth"></div>
          </div>
          <div class="robot-arm left"></div>
          <div class="robot-arm right"></div>
          <div class="robot-body"></div>
        </div>
        <div class="mascot-speech">
          <div class="mascot-name">Buddy Bot</div>
          <div class="mascot-message" id="mascotMessage">
            <strong>Привет!</strong> Я твой помощник по задачам.<br>
            Не забудь <span class="highlight">создать задачи на сегодня</span> 🚀
          </div>
        </div>
        <button class="mascot-dismiss" id="mascotDismiss" title="Скрыть">✕</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid" id="statsGrid">
      <div class="stat-card in_progress">
        <span class="stat-emoji">🔄</span>
        <span class="stat-number" id="statInProgress">0</span>
        <span class="stat-label">В работе</span>
      </div>
      <div class="stat-card pending">
        <span class="stat-emoji">⏳</span>
        <span class="stat-number" id="statPending">0</span>
        <span class="stat-label">Ожидает</span>
      </div>
      <div class="stat-card done">
        <span class="stat-emoji">✅</span>
        <span class="stat-number" id="statDone">0</span>
        <span class="stat-label">Готово</span>
      </div>
      <div class="stat-card snoozed">
        <span class="stat-emoji">😴</span>
        <span class="stat-number" id="statSnoozed">0</span>
        <span class="stat-label">Отложено</span>
      </div>
    </div>

    <!-- Progress -->
    <div class="progress-container">
      <div class="progress-header">
        <span class="progress-label">Общий прогресс</span>
        <span class="progress-pct" id="progressText">0%</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" id="progressFill" style="width: 0%"></div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="tab-nav" id="tabNav">
      <button class="tab-btn active" data-tab="today">
        📅 Сегодня
        <span class="tab-badge" id="tabBadgeToday">0</span>
      </button>
      <button class="tab-btn" data-tab="yesterday">
        ⏪ Вчера
        <span class="tab-badge" id="tabBadgeYesterday">0</span>
      </button>
      <button class="tab-btn" data-tab="all">
        📋 Все
        <span class="tab-badge" id="tabBadgeAll">0</span>
      </button>
    </div>

    <!-- Task Sections -->
    <div id="taskSections"></div>

    <!-- Empty State -->
    <div class="empty-state" id="emptyState" style="display: none;">
      <div class="empty-illustration">🧩</div>
      <div class="empty-title">Пока нет задач</div>
      <div class="empty-desc">AI будет создавать задачи автоматически. Они появятся здесь в реальном времени!</div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // ── State ────────────────────────────────────────────
    let allTasks = [];
    let currentTab = 'today';

    // ── Mascot Messages ─────────────────────────────────
    const MASCOT_MESSAGES = {
      noTasks: {
        text: '<strong>Привет!</strong> У тебя пока нет задач. <span class="highlight">Пора создать новые!</span> 📝',
      },
      hasPending: {
        text: '<strong>Внимание!</strong> У тебя есть <span class="highlight">незавершённые задачи</span> с прошлых дней! ⚠️',
      },
      allDone: {
        text: '<strong>Отлично!</strong> Все задачи выполнены! 🎉 Время <span class="highlight">поставить новые цели</span>.',
      },
      hasYesterday: {
        text: '<strong>Напоминание!</strong> У тебя остались <span class="highlight">задачи с вчера</span>. Не забудь про них! 📌',
      },
      morning: {
        text: '<strong>Доброе утро!</strong> ☀️ Начни день с <span class="highlight">планирования задач</span>.',
      },
      evening: {
        text: '<strong>Добрый вечер!</strong> 🌙 Проверь <span class="highlight">статус задач</span> и подведи итоги дня.',
      },
      default: {
        text: '<strong>Привет!</strong> Я твой помощник по задачам. Не забудь <span class="highlight">создать задачи на сегодня</span> 🚀',
      },
    };

    // ── Date helpers ─────────────────────────────────────
    function getDateStr(date) {
      const d = new Date(date);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function getTodayStr() {
      return getDateStr(new Date());
    }

    function getYesterdayStr() {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return getDateStr(d);
    }

    function isToday(dateStr) {
      return getDateStr(dateStr) === getTodayStr();
    }

    function isYesterday(dateStr) {
      return getDateStr(dateStr) === getYesterdayStr();
    }

    function formatDate(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'только что';
      if (mins < 60) return mins + ' мин назад';
      const hours = Math.floor(mins / 60);
      if (hours < 24) return hours + ' ч назад';
      const days = Math.floor(hours / 24);
      if (days === 1) return 'вчера';
      if (days < 7) return days + ' дн назад';
      return d.toLocaleDateString('ru-RU');
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // ── Categorize tasks by date ─────────────────────────
    function categorizeTasks(tasks) {
      const today = getTodayStr();
      const yesterday = getYesterdayStr();

      const todayTasks = [];
      const yesterdayTasks = [];
      const olderTasks = [];

      // Today's tasks include:
      // 1. Tasks created today
      // 2. Tasks from yesterday that are NOT done (carried over)
      tasks.forEach(t => {
        const created = getDateStr(t.createdAt);
        if (created === today) {
          todayTasks.push({ ...t, _carriedOver: false });
        } else if (created === yesterday) {
          if (t.status !== 'done') {
            // Also show in today as carried over
            todayTasks.push({ ...t, _carriedOver: true });
          }
          yesterdayTasks.push({ ...t, _carriedOver: false });
        } else {
          if (t.status !== 'done') {
            todayTasks.push({ ...t, _carriedOver: true });
          }
          olderTasks.push({ ...t, _carriedOver: false });
        }
      });

      return { todayTasks, yesterdayTasks, olderTasks };
    }

    // ── Update mascot message ────────────────────────────
    function updateMascot(tasks) {
      const msgEl = document.getElementById('mascotMessage');
      const { todayTasks, yesterdayTasks } = categorizeTasks(tasks);

      const hour = new Date().getHours();
      const carriedOver = todayTasks.filter(t => t._carriedOver);
      const activeTasks = tasks.filter(t => t.status !== 'done');

      let msg;

      if (tasks.length === 0) {
        msg = MASCOT_MESSAGES.noTasks;
      } else if (carriedOver.length > 0) {
        msg = MASCOT_MESSAGES.hasYesterday;
      } else if (activeTasks.length === 0) {
        msg = MASCOT_MESSAGES.allDone;
      } else if (hour < 12) {
        msg = MASCOT_MESSAGES.morning;
      } else if (hour >= 18) {
        msg = MASCOT_MESSAGES.evening;
      } else {
        msg = MASCOT_MESSAGES.default;
      }

      msgEl.innerHTML = msg.text;
    }

    // ── Render ───────────────────────────────────────────
    const STATUS_CONFIG = {
      in_progress: { icon: '🔄', label: 'В работе' },
      pending:     { icon: '⏳', label: 'Ожидает' },
      snoozed:     { icon: '😴', label: 'Отложено' },
      done:        { icon: '✅', label: 'Готово' },
    };

    const STATUS_ORDER = ['in_progress', 'pending', 'snoozed', 'done'];

    function renderTasks() {
      const tasks = allTasks;
      const { todayTasks, yesterdayTasks, olderTasks } = categorizeTasks(tasks);

      // Stats (total)
      const counts = { pending: 0, in_progress: 0, done: 0, snoozed: 0 };
      tasks.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });

      document.getElementById('statPending').textContent = counts.pending;
      document.getElementById('statInProgress').textContent = counts.in_progress;
      document.getElementById('statDone').textContent = counts.done;
      document.getElementById('statSnoozed').textContent = counts.snoozed;

      // Animate stat numbers
      document.querySelectorAll('.stat-number').forEach(el => {
        el.style.transform = 'scale(1.2)';
        setTimeout(() => { el.style.transform = 'scale(1)'; el.style.transition = 'transform 0.3s ease'; }, 50);
      });

      // Progress
      const total = tasks.length;
      const doneCount = counts.done;
      const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
      document.getElementById('progressFill').style.width = pct + '%';
      document.getElementById('progressText').textContent = pct + '% (' + doneCount + '/' + total + ')';

      // Tab badges
      document.getElementById('tabBadgeToday').textContent = todayTasks.length;
      document.getElementById('tabBadgeYesterday').textContent = yesterdayTasks.length;
      document.getElementById('tabBadgeAll').textContent = tasks.length;

      // Determine which tasks to show
      let tasksToShow = [];
      let dateConfig = {};

      if (currentTab === 'today') {
        tasksToShow = todayTasks;
        dateConfig = {
          icon: '📅',
          label: 'Задачи на сегодня',
          sublabel: new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }),
          cssClass: '',
        };
      } else if (currentTab === 'yesterday') {
        tasksToShow = yesterdayTasks;
        const yd = new Date();
        yd.setDate(yd.getDate() - 1);
        dateConfig = {
          icon: '⏪',
          label: 'Задачи за вчера',
          sublabel: yd.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }),
          cssClass: 'yesterday',
        };
      } else {
        tasksToShow = tasks.map(t => ({ ...t, _carriedOver: false }));
        dateConfig = {
          icon: '📋',
          label: 'Все задачи',
          sublabel: 'Полный список',
          cssClass: 'older',
        };
      }

      // Empty state
      const emptyEl = document.getElementById('emptyState');
      const sectionsEl = document.getElementById('taskSections');

      if (tasks.length === 0) {
        emptyEl.style.display = 'block';
        sectionsEl.innerHTML = '';
        return;
      }

      emptyEl.style.display = 'none';

      if (tasksToShow.length === 0) {
        sectionsEl.innerHTML =
          '<div class="empty-state">' +
            '<div class="empty-illustration">🎯</div>' +
            '<div class="empty-title">' + (currentTab === 'yesterday' ? 'Нет задач за вчера' : 'Нет задач на сегодня') + '</div>' +
            '<div class="empty-desc">' + (currentTab === 'yesterday' ? 'Здесь пока пусто.' : 'Все старые задачи выполнены. Отличная работа!') + '</div>' +
          '</div>';
        return;
      }

      // Build HTML
      let html = '';

      // Date header
      html += '<div class="date-section">';
      html += '<div class="date-section-header ' + dateConfig.cssClass + '">';
      html += '  <span class="date-icon">' + dateConfig.icon + '</span>';
      html += '  <div class="date-info">';
      html += '    <div class="date-label">' + dateConfig.label + '</div>';
      html += '    <div class="date-sublabel">' + dateConfig.sublabel + '</div>';
      html += '  </div>';
      html += '  <span class="date-count">' + tasksToShow.length + ' задач</span>';
      html += '</div>';

      // Group by status
      let delayIdx = 0;
      STATUS_ORDER.forEach(status => {
        const filtered = tasksToShow.filter(t => t.status === status);
        if (filtered.length === 0) return;

        const config = STATUS_CONFIG[status];

        html += '<div class="status-group">';
        html += '  <div class="status-group-title">' + config.icon + ' ' + config.label + ' (' + filtered.length + ')</div>';
        html += '  <div class="task-list">';

        filtered.forEach(task => {
          const carried = task._carriedOver;
          const cardClass = 'task-card ' + task.status + (carried ? ' carried-over' : '');
          const iconClass = status === 'in_progress' ? ' pulse' : '';

          let metaHtml = '<span class="task-id">#' + escapeHtml(task.id) + '</span>';
          metaHtml += '<span class="task-time">🕐 ' + formatDate(task.createdAt) + '</span>';

          if (carried) {
            metaHtml += '<span class="carry-badge">⏎ перенесено</span>';
          }

          if (task.snoozedUntil) {
            metaHtml += '<span>до ' + escapeHtml(task.snoozedUntil) + '</span>';
          }
          if (task.completedAt) {
            metaHtml += '<span>✓ ' + formatDate(task.completedAt) + '</span>';
          }

          let descHtml = '';
          if (task.description) {
            descHtml = '<div class="task-description">' + escapeHtml(task.description) + '</div>';
          }

          html += '<div class="' + cardClass + '" style="animation-delay: ' + (delayIdx * 0.04) + 's" data-task-id="' + escapeHtml(task.id) + '">';
          html += '  <span class="task-status-icon' + iconClass + '">' + config.icon + '</span>';
          html += '  <div class="task-content">';
          html += '    <div class="task-title">' + escapeHtml(task.title) + '</div>';
          html += descHtml;
          html += '    <div class="task-meta">' + metaHtml + '</div>';
          html += '  </div>';
          html += '  <div class="task-actions">';
          html += '    <button class="btn-delete" data-delete-id="' + escapeHtml(task.id) + '" title="Удалить задачу">🗑️</button>';
          html += '  </div>';
          html += '</div>';

          delayIdx++;
        });

        html += '  </div>';
        html += '</div>';
      });

      html += '</div>';

      sectionsEl.innerHTML = html;

      // Attach delete handlers via event delegation
      sectionsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete');
        if (!btn) return;
        const taskId = btn.getAttribute('data-delete-id');
        if (!taskId) return;

        // Animate the card out
        const card = btn.closest('.task-card');
        if (card) {
          card.classList.add('deleting');
        }

        // Send delete message after animation
        setTimeout(() => {
          vscode.postMessage({ type: 'deleteTask', taskId: taskId });
        }, 350);
      });
    }

    // ── Tab click handlers ───────────────────────────────
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        renderTasks();
      });
    });

    // ── Mascot dismiss ──────────────────────────────────
    document.getElementById('mascotDismiss').addEventListener('click', () => {
      const container = document.getElementById('mascotContainer');
      container.style.animation = 'fadeOutUp 0.3s ease-out forwards';
      setTimeout(() => { container.style.display = 'none'; }, 300);
    });

    // Add the fadeOutUp animation
    const style = document.createElement('style');
    style.textContent = '@keyframes fadeOutUp { to { opacity: 0; transform: translateY(-10px); height: 0; margin: 0; padding: 0; overflow: hidden; } }';
    document.head.appendChild(style);

    // ── Message handler ─────────────────────────────────
    window.addEventListener('message', (event) => {
      const { type, tasks, lastUpdated } = event.data;
      if (type === 'update') {
        allTasks = tasks || [];

        // Update timestamp
        if (lastUpdated) {
          const d = new Date(lastUpdated);
          document.getElementById('lastUpdated').textContent = 'Обновлено ' + d.toLocaleTimeString('ru-RU');
        }

        updateMascot(allTasks);
        renderTasks();
      }
    });
  </script>
</body>
</html>`;
  }
}
