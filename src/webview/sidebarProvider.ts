import * as vscode from "vscode";
import { loadTasks, loadTasksFromRemote, deleteTask, deleteTaskFromRemote, type Task } from "../taskManager";

export class DevFlowSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "devflow.tasks";
  private _view?: vscode.WebviewView;
  private _serverUrl?: string;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _workDir?: string,
    serverUrl?: string
  ) {
    this._serverUrl = serverUrl;
  }

  public setServerUrl(url?: string): void {
    this._serverUrl = url;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml();
    this.refresh();

    // Handle messages from sidebar webview
    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "deleteTask" && msg.taskId) {
        if (this._serverUrl) {
          // Delete from remote server
          deleteTaskFromRemote(this._serverUrl, msg.taskId).then(() => {
            this.refresh();
          });
        } else {
          // Delete locally
          const dir = this._workDir || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (dir) {
            deleteTask(dir, msg.taskId);
            this.refresh();
          }
        }
      } else if (msg.type === "addTask") {
        vscode.commands.executeCommand("devflow.addTask");
      }
    });
  }

  public refresh(): void {
    if (!this._view) return;

    const dir = this._workDir || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    let localTasks: Task[] = [];
    if (dir) {
      try {
        const data = loadTasks(dir);
        localTasks = data.tasks;
      } catch { /* ignore */ }
    }

    if (this._serverUrl) {
      loadTasksFromRemote(this._serverUrl).then((remoteData) => {
        const localIds = new Set(localTasks.map(t => t.id));
        const uniqueRemote = remoteData.tasks.filter(t => !localIds.has(t.id));
        const merged = [...localTasks, ...uniqueRemote];
        this._view?.webview.postMessage({ type: "update", tasks: merged });
      }).catch(() => {
        this._view?.webview.postMessage({ type: "update", tasks: localTasks });
      });
    } else {
      this._view?.webview.postMessage({ type: "update", tasks: localTasks });
    }
  }

  private _getHtml(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  /* ─── Reset & Base — Monochrome Minimal ─── */
  * { margin:0; padding:0; box-sizing:border-box; }

  :root {
    --bg: var(--vscode-sideBar-background, #1a1a1a);
    --fg: var(--vscode-sideBar-foreground, #cccccc);
    --fg2: var(--vscode-descriptionForeground, #888888);
    --fg3: var(--vscode-disabledForeground, #555555);
    --border: var(--vscode-widget-border, rgba(255,255,255,0.06));
    --hover: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
    --active: var(--vscode-list-activeSelectionBackground, rgba(255,255,255,0.08));
    --accent: var(--vscode-focusBorder, #888);
    --danger: #e55;
    --success: #6a6;
    --warn: #aa8;
    --r: 6px;
    --t: 0.15s ease;
  }

  body {
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 12px;
    color: var(--fg);
    background: var(--bg);
    padding: 0;
    line-height: 1.5;
    overflow-x: hidden;
  }

  /* ─── Header ─── */
  .hdr {
    padding: 12px 14px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--bg);
    z-index: 10;
  }

  .hdr-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .hdr-logo {
    width: 20px; height: 20px;
    border-radius: 4px;
    background: var(--fg3);
    display: flex; align-items: center; justify-content: center;
    font-size: 10px;
    color: var(--bg);
    font-weight: 800;
  }

  .hdr-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--fg2);
  }

  .hdr-actions {
    display: flex;
    gap: 2px;
  }

  .icon-btn {
    background: none;
    border: none;
    color: var(--fg3);
    cursor: pointer;
    padding: 4px 6px;
    border-radius: var(--r);
    font-size: 13px;
    transition: var(--t);
    display: flex;
    align-items: center;
    line-height: 1;
  }
  .icon-btn:hover { color: var(--fg); background: var(--hover); }

  /* ─── Stats Row ─── */
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
  }

  .stat {
    text-align: center;
    padding: 6px 0;
    cursor: default;
  }

  .stat-n {
    font-size: 16px;
    font-weight: 700;
    color: var(--fg);
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }

  .stat-l {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--fg3);
    margin-top: 1px;
  }

  /* ─── Tabs ─── */
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 44px;
    background: var(--bg);
    z-index: 9;
  }

  .tab {
    flex: 1;
    padding: 8px 0;
    border: none;
    background: none;
    color: var(--fg3);
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: var(--t);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .tab:hover { color: var(--fg2); }

  .tab.on {
    color: var(--fg);
  }

  .tab.on::after {
    content: '';
    position: absolute;
    bottom: 0; left: 20%; right: 20%;
    height: 1px;
    background: var(--fg);
  }

  .tab-n {
    font-size: 9px;
    padding: 0 4px;
    border-radius: 8px;
    background: rgba(255,255,255,0.06);
    color: var(--fg3);
    font-weight: 700;
    min-width: 14px;
    text-align: center;
  }
  .tab.on .tab-n { background: rgba(255,255,255,0.1); color: var(--fg2); }

  /* ─── Mascot Banner ─── */
  .mascot {
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid var(--border);
    cursor: default;
    transition: var(--t);
  }

  .mascot:hover { background: var(--hover); }

  .mascot-face {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    position: relative;
  }

  /* CSS Robot face */
  .bot-head {
    width: 28px; height: 22px;
    background: var(--fg3);
    border-radius: 6px 6px 4px 4px;
    position: absolute;
    left: 2px; top: 3px;
    display: flex; align-items: center; justify-content: center; gap: 5px;
  }

  .bot-head::before {
    content: '';
    position: absolute;
    top: -5px; left: 50%; transform: translateX(-50%);
    width: 3px; height: 5px;
    background: var(--fg3);
    border-radius: 1px 1px 0 0;
  }

  .bot-head::after {
    content: '';
    position: absolute;
    top: -8px; left: 50%; transform: translateX(-50%);
    width: 5px; height: 5px;
    background: var(--fg2);
    border-radius: 50%;
    animation: bip 2s ease-in-out infinite;
  }

  @keyframes bip {
    0%,100% { opacity: 0.4; }
    50% { opacity: 1; }
  }

  .bot-eye {
    width: 6px; height: 6px;
    background: var(--bg);
    border-radius: 50%;
    animation: blink 4s ease infinite;
  }

  @keyframes blink {
    0%,42%,58%,100% { transform: scaleY(1); }
    50% { transform: scaleY(0.1); }
  }

  .bot-body {
    width: 22px; height: 8px;
    background: var(--fg3);
    border-radius: 3px;
    position: absolute;
    left: 5px; top: 26px;
    opacity: 0.7;
  }

  .mascot-msg {
    font-size: 11px;
    color: var(--fg2);
    line-height: 1.4;
    flex: 1;
  }
  .mascot-msg b { color: var(--fg); font-weight: 600; }

  .mascot-x {
    background: none; border: none;
    color: var(--fg3);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 11px;
    border-radius: 3px;
    transition: var(--t);
    flex-shrink: 0;
  }
  .mascot-x:hover { color: var(--fg); background: var(--hover); }

  /* ─── Task List ─── */
  .list { padding: 4px 0; }

  .group-label {
    padding: 6px 14px 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--fg3);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .group-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  .task {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    cursor: default;
    transition: background var(--t);
    position: relative;
    animation: fadeIn 0.2s ease forwards;
    opacity: 0;
  }

  @keyframes fadeIn {
    to { opacity: 1; }
  }

  .task:hover { background: var(--hover); }

  .task-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1.5px solid var(--fg3);
    transition: var(--t);
  }

  .task.in_progress .task-dot {
    border-color: var(--fg);
    background: var(--fg);
    animation: dotPulse 2s ease-in-out infinite;
  }

  @keyframes dotPulse {
    0%,100% { opacity: 1; box-shadow: 0 0 0 0 rgba(255,255,255,0.3); }
    50% { opacity: 0.6; box-shadow: 0 0 0 3px rgba(255,255,255,0); }
  }

  .task.pending .task-dot { border-color: var(--fg3); }

  .task.done .task-dot {
    border-color: var(--fg3);
    background: var(--fg3);
  }

  .task.snoozed .task-dot {
    border-color: var(--fg3);
    border-style: dashed;
  }

  .task-body {
    flex: 1;
    min-width: 0;
  }

  .task-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--fg);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task.done .task-title {
    text-decoration: line-through;
    color: var(--fg3);
  }

  .task-sub {
    font-size: 10px;
    color: var(--fg3);
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 1px;
  }

  .task-sub .carried {
    color: var(--warn);
    font-weight: 600;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Delete btn — appears on hover */
  .task-del {
    opacity: 0;
    background: none;
    border: none;
    color: var(--fg3);
    cursor: pointer;
    padding: 3px 5px;
    font-size: 12px;
    border-radius: 3px;
    transition: var(--t);
    flex-shrink: 0;
    line-height: 1;
  }

  .task:hover .task-del { opacity: 1; }
  .task-del:hover { color: var(--danger); background: rgba(238,85,85,0.1); }

  /* Delete animation */
  .task.removing {
    animation: slideOut 0.25s ease forwards;
    pointer-events: none;
  }

  @keyframes slideOut {
    to { opacity: 0; transform: translateX(20px); height: 0; padding-top: 0; padding-bottom: 0; overflow: hidden; }
  }

  /* ─── Empty ─── */
  .empty {
    padding: 32px 20px;
    text-align: center;
    color: var(--fg3);
  }

  .empty-icon {
    font-size: 28px;
    margin-bottom: 8px;
    opacity: 0.4;
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%,100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }

  .empty-text {
    font-size: 11px;
    line-height: 1.5;
  }

  /* ─── Scrollbar ─── */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
</style>
</head>
<body>

<!-- Header -->
<div class="hdr">
  <div class="hdr-left">
    <div class="hdr-logo">D</div>
    <span class="hdr-title">DevFlow</span>
  </div>
  <div class="hdr-actions">
    <button class="icon-btn" id="btnAdd" title="Add task">＋</button>
  </div>
</div>

<!-- Stats -->
<div class="stats" id="stats">
  <div class="stat"><div class="stat-n" id="sIP">0</div><div class="stat-l">Work</div></div>
  <div class="stat"><div class="stat-n" id="sP">0</div><div class="stat-l">Todo</div></div>
  <div class="stat"><div class="stat-n" id="sD">0</div><div class="stat-l">Done</div></div>
  <div class="stat"><div class="stat-n" id="sS">0</div><div class="stat-l">Sleep</div></div>
</div>

<!-- Tabs -->
<div class="tabs">
  <button class="tab on" data-t="today">Today <span class="tab-n" id="tToday">0</span></button>
  <button class="tab" data-t="yesterday">Yesterday <span class="tab-n" id="tYday">0</span></button>
  <button class="tab" data-t="all">All <span class="tab-n" id="tAll">0</span></button>
</div>

<!-- Mascot -->
<div class="mascot" id="mascot">
  <div class="mascot-face">
    <div class="bot-head"><div class="bot-eye"></div><div class="bot-eye"></div></div>
    <div class="bot-body"></div>
  </div>
  <div class="mascot-msg" id="mascotMsg"><b>Hey!</b> Create tasks for today</div>
  <button class="mascot-x" id="mascotX">✕</button>
</div>

<!-- Task List -->
<div class="list" id="list"></div>

<!-- Empty -->
<div class="empty" id="empty" style="display:none">
  <div class="empty-icon">◇</div>
  <div class="empty-text">No tasks yet.<br>AI will add them automatically.</div>
</div>

<script>
const vscode = acquireVsCodeApi();
let allTasks = [];
let tab = 'today';

// ── Date helpers ──
function dayStr(d) {
  const x = new Date(d);
  return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
}
const TODAY = dayStr(new Date());
const YDAY = (() => { const d = new Date(); d.setDate(d.getDate()-1); return dayStr(d); })();

function ago(iso) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ── Categorize ──
function split(tasks) {
  const t = [], y = [];
  tasks.forEach(tk => {
    const c = dayStr(tk.createdAt);
    if (c === TODAY) t.push({...tk, _carry: false});
    else if (c === YDAY) {
      if (tk.status !== 'done') t.push({...tk, _carry: true});
      y.push({...tk, _carry: false});
    } else {
      if (tk.status !== 'done') t.push({...tk, _carry: true});
    }
  });
  return { today: t, yesterday: y };
}

// ── Mascot ──
function updateMascot(tasks) {
  const el = document.getElementById('mascotMsg');
  const { today: td } = split(tasks);
  const carried = td.filter(t => t._carry).length;
  const active = tasks.filter(t => t.status !== 'done').length;
  const hour = new Date().getHours();

  if (tasks.length === 0) el.innerHTML = '<b>No tasks.</b> Time to plan!';
  else if (carried > 0) el.innerHTML = '<b>' + carried + ' carried over</b> from before';
  else if (active === 0) el.innerHTML = '<b>All done!</b> Great work ✓';
  else if (hour < 12) el.innerHTML = '<b>Morning.</b> ' + active + ' tasks waiting';
  else if (hour >= 18) el.innerHTML = '<b>Evening.</b> Review your progress';
  else el.innerHTML = '<b>' + active + ' active.</b> Keep going';
}

// ── Render ──
const ORDER = ['in_progress','pending','snoozed','done'];
const LABELS = { in_progress:'Working', pending:'Todo', snoozed:'Snoozed', done:'Done' };

function render() {
  const { today: todayTasks, yesterday: ydayTasks } = split(allTasks);

  // stats
  const c = { pending:0, in_progress:0, done:0, snoozed:0 };
  allTasks.forEach(t => c[t.status]=(c[t.status]||0)+1);
  document.getElementById('sIP').textContent = c.in_progress;
  document.getElementById('sP').textContent = c.pending;
  document.getElementById('sD').textContent = c.done;
  document.getElementById('sS').textContent = c.snoozed;

  // tab badges
  document.getElementById('tToday').textContent = todayTasks.length;
  document.getElementById('tYday').textContent = ydayTasks.length;
  document.getElementById('tAll').textContent = allTasks.length;

  // pick tasks
  let show = [];
  if (tab === 'today') show = todayTasks;
  else if (tab === 'yesterday') show = ydayTasks;
  else show = allTasks.map(t => ({...t, _carry: false}));

  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty');

  if (allTasks.length === 0) {
    emptyEl.style.display = '';
    listEl.innerHTML = '';
    return;
  }
  emptyEl.style.display = 'none';

  if (show.length === 0) {
    listEl.innerHTML = '<div class="empty"><div class="empty-icon">—</div><div class="empty-text">No tasks here</div></div>';
    return;
  }

  let html = '';
  let idx = 0;
  ORDER.forEach(st => {
    const filt = show.filter(t => t.status === st);
    if (!filt.length) return;
    html += '<div class="group-label">' + LABELS[st] + '</div>';
    filt.forEach(t => {
      const sub = '<span>' + ago(t.createdAt) + '</span>'
        + (t._carry ? '<span class="carried">↩ carried</span>' : '')
        + (t.completedAt ? '<span>✓ ' + ago(t.completedAt) + '</span>' : '');
      html += '<div class="task ' + t.status + '" style="animation-delay:' + (idx*0.03) + 's" data-id="' + esc(t.id) + '">'
        + '<div class="task-dot"></div>'
        + '<div class="task-body">'
        + '<div class="task-title">' + esc(t.title) + '</div>'
        + '<div class="task-sub">#' + esc(t.id) + ' · ' + sub + '</div>'
        + '</div>'
        + '<button class="task-del" data-del="' + esc(t.id) + '" title="Delete">✕</button>'
        + '</div>';
      idx++;
    });
  });
  listEl.innerHTML = html;
}

// ── Events ──
document.querySelector('.tabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  tab = btn.dataset.t;
  render();
});

document.getElementById('list').addEventListener('click', e => {
  const btn = e.target.closest('.task-del');
  if (!btn) return;
  const id = btn.dataset.del;
  const row = btn.closest('.task');
  if (row) row.classList.add('removing');
  setTimeout(() => vscode.postMessage({ type: 'deleteTask', taskId: id }), 200);
});

document.getElementById('mascotX').addEventListener('click', () => {
  document.getElementById('mascot').style.display = 'none';
});

document.getElementById('btnAdd').addEventListener('click', () => {
  vscode.postMessage({ type: 'addTask' });
});



// ── Message from extension ──
window.addEventListener('message', e => {
  if (e.data.type === 'update') {
    allTasks = e.data.tasks || [];
    updateMascot(allTasks);
    render();
  }
});
</script>
</body>
</html>`;
  }
}
