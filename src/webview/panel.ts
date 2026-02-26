import * as vscode from "vscode";
import { loadTasks, loadTasksFromRemote } from "../taskManager";

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
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-card: #1c2333;
      --bg-card-hover: #242d3d;
      --border: #30363d;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --text-muted: #6e7681;
      --accent-blue: #58a6ff;
      --accent-green: #3fb950;
      --accent-orange: #d29922;
      --accent-purple: #bc8cff;
      --accent-red: #f85149;
      --glow-blue: rgba(88, 166, 255, 0.15);
      --glow-green: rgba(63, 185, 80, 0.15);
      --glow-orange: rgba(210, 153, 34, 0.15);
      --glow-purple: rgba(188, 140, 255, 0.15);
      --radius: 12px;
      --transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 20px;
      overflow-x: hidden;
    }

    /* ── Header ─────────────────────────────────────── */

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    .header h1 {
      font-size: 22px;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.5px;
    }

    .header .last-updated {
      font-size: 12px;
      color: var(--text-muted);
    }

    /* ── Stats Bar ──────────────────────────────────── */

    .stats-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      text-align: center;
      transition: var(--transition);
      position: relative;
      overflow: hidden;
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      border-radius: var(--radius) var(--radius) 0 0;
    }

    .stat-card.pending::before { background: var(--accent-orange); }
    .stat-card.in_progress::before { background: var(--accent-blue); }
    .stat-card.done::before { background: var(--accent-green); }
    .stat-card.snoozed::before { background: var(--accent-purple); }

    .stat-card:hover {
      background: var(--bg-card-hover);
      transform: translateY(-2px);
    }

    .stat-number {
      font-size: 28px;
      font-weight: 700;
      display: block;
    }

    .stat-card.pending .stat-number { color: var(--accent-orange); }
    .stat-card.in_progress .stat-number { color: var(--accent-blue); }
    .stat-card.done .stat-number { color: var(--accent-green); }
    .stat-card.snoozed .stat-number { color: var(--accent-purple); }

    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    /* ── Progress Bar ───────────────────────────────── */

    .progress-container {
      margin-bottom: 24px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
      color: var(--text-secondary);
    }

    .progress-bar {
      height: 8px;
      background: var(--bg-secondary);
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    }

    .progress-fill {
      height: 100%;
      border-radius: 4px;
      background: linear-gradient(90deg, var(--accent-green), #56d364);
      transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    .progress-fill::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255,255,255,0.15) 50%,
        transparent 100%
      );
      animation: shimmer 2s infinite;
    }

    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    /* ── Task list ──────────────────────────────────── */

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-title .icon {
      font-size: 16px;
    }

    .task-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 24px;
    }

    .task-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px 16px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      transition: var(--transition);
      animation: slideIn 0.3s ease-out forwards;
      opacity: 0;
      transform: translateX(-10px);
    }

    .task-card:hover {
      background: var(--bg-card-hover);
      border-color: rgba(255,255,255,0.1);
      transform: translateX(4px);
    }

    @keyframes slideIn {
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .task-card.done {
      opacity: 0.6;
      border-left: 3px solid var(--accent-green);
    }

    .task-card.in_progress {
      border-left: 3px solid var(--accent-blue);
      box-shadow: 0 0 20px var(--glow-blue);
    }

    .task-card.pending {
      border-left: 3px solid var(--accent-orange);
    }

    .task-card.snoozed {
      border-left: 3px solid var(--accent-purple);
      opacity: 0.7;
    }

    .task-status-icon {
      font-size: 18px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .task-content {
      flex: 1;
      min-width: 0;
    }

    .task-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
      word-break: break-word;
    }

    .task-card.done .task-title {
      text-decoration: line-through;
      color: var(--text-secondary);
    }

    .task-meta {
      display: flex;
      gap: 12px;
      margin-top: 6px;
      font-size: 11px;
      color: var(--text-muted);
    }

    .task-id {
      font-family: 'SF Mono', 'Fira Code', monospace;
      color: var(--accent-blue);
      opacity: 0.7;
    }

    .task-description {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
      line-height: 1.4;
    }

    /* ── Empty state ────────────────────────────────── */

    .empty-state {
      text-align: center;
      padding: 48px 20px;
      color: var(--text-muted);
    }

    .empty-state .icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.4;
    }

    .empty-state p {
      font-size: 14px;
      max-width: 300px;
      margin: 0 auto;
      line-height: 1.6;
    }

    /* ── Pulse animation for in-progress ────────────── */

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .pulse {
      animation: pulse 2s ease-in-out infinite;
    }

    /* ── Activity feed ──────────────────────────────── */

    .activity-feed {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
    }

    .activity-item {
      display: flex;
      gap: 10px;
      padding: 8px 0;
      font-size: 12px;
      color: var(--text-secondary);
      align-items: center;
    }

    .activity-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .activity-dot.done { background: var(--accent-green); }
    .activity-dot.added { background: var(--accent-blue); }
    .activity-dot.snoozed { background: var(--accent-purple); }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚡ DevFlow</h1>
    <span class="last-updated" id="lastUpdated">—</span>
  </div>

  <div class="stats-bar" id="statsBar">
    <div class="stat-card in_progress">
      <span class="stat-number" id="statInProgress">0</span>
      <span class="stat-label">In Progress</span>
    </div>
    <div class="stat-card pending">
      <span class="stat-number" id="statPending">0</span>
      <span class="stat-label">Pending</span>
    </div>
    <div class="stat-card done">
      <span class="stat-number" id="statDone">0</span>
      <span class="stat-label">Done</span>
    </div>
    <div class="stat-card snoozed">
      <span class="stat-number" id="statSnoozed">0</span>
      <span class="stat-label">Snoozed</span>
    </div>
  </div>

  <div class="progress-container">
    <div class="progress-header">
      <span>Progress</span>
      <span id="progressText">0%</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" id="progressFill" style="width: 0%"></div>
    </div>
  </div>

  <div id="taskSections"></div>

  <div class="empty-state" id="emptyState" style="display: none;">
    <div class="icon">📋</div>
    <p>No tasks yet. AI will add tasks here as it works — watch them appear in real-time!</p>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    const STATUS_CONFIG = {
      in_progress: { icon: '🔄', label: 'In Progress', section: '🔄 In Progress' },
      pending:     { icon: '⏳', label: 'Pending',     section: '⏳ Pending' },
      snoozed:     { icon: '😴', label: 'Snoozed',     section: '😴 Snoozed' },
      done:        { icon: '✅', label: 'Done',         section: '✅ Done' },
    };

    window.addEventListener('message', (event) => {
      const { type, tasks, lastUpdated } = event.data;
      if (type === 'update') {
        render(tasks, lastUpdated);
      }
    });

    function render(tasks, lastUpdated) {
      // Stats
      const counts = { pending: 0, in_progress: 0, done: 0, snoozed: 0 };
      tasks.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });

      document.getElementById('statPending').textContent = counts.pending;
      document.getElementById('statInProgress').textContent = counts.in_progress;
      document.getElementById('statDone').textContent = counts.done;
      document.getElementById('statSnoozed').textContent = counts.snoozed;

      // Progress
      const total = tasks.length;
      const doneCount = counts.done;
      const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
      document.getElementById('progressFill').style.width = pct + '%';
      document.getElementById('progressText').textContent = pct + '% (' + doneCount + '/' + total + ')';

      // Last updated
      if (lastUpdated) {
        const d = new Date(lastUpdated);
        document.getElementById('lastUpdated').textContent = 'Updated ' + d.toLocaleTimeString();
      }

      // Empty state
      document.getElementById('emptyState').style.display = total === 0 ? 'block' : 'none';

      // Task sections
      const container = document.getElementById('taskSections');
      container.innerHTML = '';

      const order = ['in_progress', 'pending', 'snoozed', 'done'];

      order.forEach(status => {
        const filtered = tasks.filter(t => t.status === status);
        if (filtered.length === 0) return;

        const config = STATUS_CONFIG[status];

        const section = document.createElement('div');
        section.innerHTML = '<div class="section-title">' + config.section + '</div>';

        const list = document.createElement('div');
        list.className = 'task-list';

        filtered.forEach((task, i) => {
          const card = document.createElement('div');
          card.className = 'task-card ' + task.status;
          card.style.animationDelay = (i * 0.05) + 's';

          const iconClass = status === 'in_progress' ? ' pulse' : '';

          let metaHtml = '<span class="task-id">#' + task.id + '</span>';
          metaHtml += '<span>' + formatDate(task.createdAt) + '</span>';
          if (task.snoozedUntil) {
            metaHtml += '<span>until ' + task.snoozedUntil + '</span>';
          }
          if (task.completedAt) {
            metaHtml += '<span>completed ' + formatDate(task.completedAt) + '</span>';
          }

          let descHtml = '';
          if (task.description) {
            descHtml = '<div class="task-description">' + escapeHtml(task.description) + '</div>';
          }

          card.innerHTML =
            '<span class="task-status-icon' + iconClass + '">' + config.icon + '</span>' +
            '<div class="task-content">' +
              '<div class="task-title">' + escapeHtml(task.title) + '</div>' +
              descHtml +
              '<div class="task-meta">' + metaHtml + '</div>' +
            '</div>';

          list.appendChild(card);
        });

        section.appendChild(list);
        container.appendChild(section);
      });
    }

    function formatDate(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return mins + 'm ago';
      const hours = Math.floor(mins / 60);
      if (hours < 24) return hours + 'h ago';
      return d.toLocaleDateString();
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;
  }
}
