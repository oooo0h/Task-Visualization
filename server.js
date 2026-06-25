"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT) || 4173;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, ".flowlog-data");
const STATE_FILE = path.join(DATA_DIR, "task-state.json");
const PID_FILE = path.join(DATA_DIR, "server.pid");
const REPORT_DIR = path.join(ROOT, "reports");
const REPORT_HOUR = 17;
const MAX_BODY_BYTES = 30 * 1024 * 1024;
const COMPLETED_CLEANUP_DAYS = 30;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function compact(value, limit = 42) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function normalizePriority(value) {
  return Math.min(10, Math.max(0, Math.round(Number(value) || 0)));
}

function buildGraph(state) {
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];
  const edges = Array.isArray(state.edges) ? state.edges : [];
  const byId = new Map(nodes.map((node) => [String(node.id), node]));
  const outgoing = new Map(nodes.map((node) => [String(node.id), []]));
  const incoming = new Map(nodes.map((node) => [String(node.id), []]));
  edges.forEach((edge) => {
    const from = String(edge.from);
    const to = String(edge.to);
    if (!byId.has(from) || !byId.has(to)) return;
    outgoing.get(from).push(to);
    incoming.get(to).push(from);
  });
  return { nodes, byId, outgoing, incoming };
}

function connectedComponents(graph) {
  const visited = new Set();
  const components = [];
  graph.nodes.forEach((node) => {
    const nodeId = String(node.id);
    if (visited.has(nodeId)) return;
    const component = [];
    const queue = [nodeId];
    while (queue.length) {
      const currentId = queue.shift();
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const current = graph.byId.get(currentId);
      if (current) component.push(current);
      [...(graph.outgoing.get(currentId) || []), ...(graph.incoming.get(currentId) || [])]
        .forEach((nextId) => { if (!visited.has(nextId)) queue.push(nextId); });
    }
    if (component.length) components.push(component);
  });
  return components;
}

function normalizeCompletionDate(value) {
  const date = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function dateDaysAgo(days, now = new Date()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return isoDate(date);
}

function cleanupExpiredCompletedChains(state, now = new Date()) {
  if (!Array.isArray(state?.nodes) || !Array.isArray(state?.edges)) return state;
  const graph = buildGraph(state);
  const cutoff = dateDaysAgo(COMPLETED_CLEANUP_DAYS, now);
  const expiredIds = new Set();
  connectedComponents(graph).forEach((component) => {
    if (!component.length || !component.every((node) => node.status === "done")) return;
    const completedAt = component
      .map((node) => normalizeCompletionDate(node.completedAt) || normalizeCompletionDate(node.date))
      .filter(Boolean)
      .sort()
      .at(-1) || "";
    if (completedAt && completedAt < cutoff) component.forEach((node) => expiredIds.add(String(node.id)));
  });
  if (!expiredIds.size) return state;
  state.nodes = state.nodes.filter((node) => !expiredIds.has(String(node.id)));
  state.edges = state.edges.filter((edge) => !expiredIds.has(String(edge.from)) && !expiredIds.has(String(edge.to)));
  if (state.view && Array.isArray(state.view.collapsedBranches)) {
    state.view.collapsedBranches = state.view.collapsedBranches.map(String).filter((id) => !expiredIds.has(id));
  }
  if (state.view && Array.isArray(state.view.autoCollapsedBranches)) {
    state.view.autoCollapsedBranches = state.view.autoCollapsedBranches.map(String).filter((id) => !expiredIds.has(id));
  }
  return state;
}

function chainStart(component, graph) {
  const ids = new Set(component.map((node) => String(node.id)));
  return component.find((node) => !(graph.incoming.get(String(node.id)) || []).some((id) => ids.has(id))) || component[0];
}

function generateDailyReport(state, now = new Date()) {
  const graph = buildGraph(state);
  const today = isoDate(now);
  const components = connectedComponents(graph);
  const componentInfo = (component) => {
    const start = chainStart(component, graph);
    return {
      start,
      requester: String(start?.requester || "").trim() || "未填写姓名",
      priority: normalizePriority(start?.priority),
      title: String(start?.title || "未命名任务"),
    };
  };
  components.sort((a, b) => {
    const left = componentInfo(a);
    const right = componentInfo(b);
    const requesterDiff = left.requester.localeCompare(right.requester, "zh-CN");
    if (requesterDiff) return requesterDiff;
    if (right.priority !== left.priority) return right.priority - left.priority;
    return left.title.localeCompare(right.title, "zh-CN");
  });

  const componentLines = (component, predicate, { markCompleted = false } = {}) => {
    const relevant = component.filter(predicate).sort((a, b) => Number(a.x) - Number(b.x) || Number(a.y) - Number(b.y));
    if (!relevant.length) return [];
    const { start, requester, title } = componentInfo(component);
    const ids = new Set(component.map((node) => String(node.id)));
    const childrenById = new Map(component.map((node) => [String(node.id), []]));
    graph.outgoing.forEach((childIds, parentId) => {
      if (!ids.has(parentId)) return;
      childIds.forEach((childId) => {
        const child = graph.byId.get(childId);
        if (child && ids.has(childId)) childrenById.get(parentId).push(child);
      });
    });
    childrenById.forEach((children) => children.sort((a, b) => Number(a.y) - Number(b.y) || Number(a.x) - Number(b.x)));
    const startBlocker = relevant.includes(start) && start.status === "blocked"
      ? `｜卡点：${compact(start.note) || compact(start.title) || "未填写"}`
      : "";
    const completionSuffix = markCompleted ? "｜已完成" : "";
    const lines = [`${requester}｜${title}${startBlocker}${completionSuffix}`];
    const relevantIds = new Set(relevant.map((node) => String(node.id)));
    const descendantMemo = new Map();
    const hasRelevantDescendant = (nodeId, visiting = new Set()) => {
      if (descendantMemo.has(nodeId)) return descendantMemo.get(nodeId);
      if (visiting.has(nodeId)) return false;
      const nextVisiting = new Set(visiting).add(nodeId);
      const result = relevantIds.has(nodeId)
        || (childrenById.get(nodeId) || []).some((child) => hasRelevantDescendant(String(child.id), nextVisiting));
      descendantMemo.set(nodeId, result);
      return result;
    };
    const rendered = new Set();
    const appendChildren = (parentId, depth, visiting = new Set()) => {
      if (visiting.has(parentId)) return;
      const nextVisiting = new Set(visiting).add(parentId);
      (childrenById.get(parentId) || []).forEach((child) => {
        const childId = String(child.id);
        if (!hasRelevantDescendant(childId) || rendered.has(childId)) return;
        const showChild = relevantIds.has(childId);
        if (showChild) {
          const label = child.status === "blocked"
            ? `卡点：${compact(child.note) || compact(child.title) || "未填写"}`
            : compact(child.note) || String(child.title || "未命名任务");
          lines.push(`${"  ".repeat(depth)}- ${label}${markCompleted ? "｜已完成" : ""}`);
          rendered.add(childId);
        }
        appendChildren(childId, showChild ? depth + 1 : depth, nextVisiting);
      });
    };
    if (start && relevantIds.has(String(start.id))) rendered.add(String(start.id));
    if (start) appendChildren(String(start.id), 1);
    relevant.forEach((node) => {
      const nodeId = String(node.id);
      if (rendered.has(nodeId)) return;
      const label = node.status === "blocked"
        ? `卡点：${compact(node.note) || compact(node.title) || "未填写"}`
        : compact(node.note) || String(node.title || "未命名任务");
      lines.push(`  - ${label}${markCompleted ? "｜已完成" : ""}`);
      rendered.add(nodeId);
    });
    return lines;
  };

  const completedToday = (node) => node?.status === "done" && String(node.completedAt || "").slice(0, 10) === today;
  const completed = components.flatMap((component) => {
    const start = chainStart(component, graph);
    const completedAsChain = component.every((node) => node.status === "done") && completedToday(start);
    return completedAsChain
      ? componentLines(component, () => true, { markCompleted: component.length > 1 })
      : componentLines(component, completedToday);
  });
  const unfinished = components.flatMap((component) => componentLines(component, (node) => node.status !== "done"));
  return [
    `工作日报｜${today}`,
    "",
    "一、今天完成",
    ...(completed.length ? completed : ["暂无"]),
    "",
    "二、未完成及卡点",
    ...(unfinished.length ? unfinished : ["暂无"]),
  ].join("\n");
}

function reportFile(date = new Date()) {
  return path.join(REPORT_DIR, `Flowlog_工作日报_${isoDate(date)}.txt`);
}

function readSavedState() {
  try {
    const payload = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    const state = payload?.state || payload;
    return Array.isArray(state?.nodes) && Array.isArray(state?.edges) ? state : null;
  } catch {
    return null;
  }
}

function saveDailyReport(date = new Date(), overwrite = false) {
  const state = readSavedState();
  if (!state) {
    console.warn(`[日报] ${isoDate(date)} 尚无任务快照，跳过保存`);
    return false;
  }
  const target = reportFile(date);
  if (!overwrite && fs.existsSync(target)) return false;
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(target, `\uFEFF${generateDailyReport(state, date)}`, "utf8");
  console.log(`[日报] 已保存 ${target}`);
  return true;
}

function saveStateSnapshot(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const cleanedState = cleanupExpiredCompletedChains(state);
  const tempFile = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify({ savedAt: new Date().toISOString(), state: cleanedState }), "utf8");
  fs.renameSync(tempFile, STATE_FILE);
  const now = new Date();
  if (now.getHours() >= REPORT_HOUR && !fs.existsSync(reportFile(now))) saveDailyReport(now);
}

function millisecondsUntilNextReport(now = new Date()) {
  const next = new Date(now);
  next.setHours(REPORT_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function scheduleDailyReport() {
  const wait = millisecondsUntilNextReport();
  setTimeout(() => {
    try {
      saveDailyReport(new Date());
    } catch (error) {
      console.error("[日报] 自动保存失败", error);
    }
    scheduleDailyReport();
  }, wait);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

function receiveJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("任务数据超过 30MB"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("JSON 格式无效"));
      }
    });
    request.on("error", reject);
  });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${HOST}:${PORT}`);
  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, service: "flowlog", pid: process.pid });
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/state") {
    try {
      const payload = await receiveJson(request);
      const state = payload?.state || payload;
      if (!Array.isArray(state?.nodes) || !Array.isArray(state?.edges)) throw new Error("缺少任务节点或连线数据");
      saveStateSnapshot(state);
      sendJson(response, 200, { ok: true, savedAt: new Date().toISOString() });
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }
  const relativePath = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const filePath = path.resolve(ROOT, relativePath);
  const isInsideRoot = filePath === ROOT || filePath.startsWith(`${ROOT}${path.sep}`);
  const isPrivate = relativePath.startsWith(".") || relativePath === "server.js" || relativePath.startsWith("reports/");
  if (!isInsideRoot || isPrivate || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  if (request.method === "HEAD") response.end();
  else fs.createReadStream(filePath).pipe(response);
}

if (require.main === module) {
  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error("请求处理失败", error);
      if (!response.headersSent) sendJson(response, 500, { ok: false, error: "Internal Server Error" });
      else response.end();
    });
  });

  server.listen(PORT, HOST, () => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PID_FILE, String(process.pid), "utf8");
    const now = new Date();
    if (now.getHours() >= REPORT_HOUR && !fs.existsSync(reportFile(now))) saveDailyReport(now);
    scheduleDailyReport();
    console.log(`Flowlog 已启动：http://${HOST}:${PORT}/`);
    console.log(`自动日报：每天 17:00 保存到 ${REPORT_DIR}`);
    console.log("停止服务：在当前终端按 Ctrl+C");
  });

  const removeOwnPidFile = () => {
    try {
      if (fs.readFileSync(PID_FILE, "utf8").trim() === String(process.pid)) fs.unlinkSync(PID_FILE);
    } catch { /* PID 文件可能尚未生成或已被关闭脚本清理 */ }
  };
  const shutdown = () => server.close(() => process.exit(0));
  process.once("exit", removeOwnPidFile);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

module.exports = { generateDailyReport, saveDailyReport };
