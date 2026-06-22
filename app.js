(() => {
  "use strict";

  const STORAGE_KEY = "flowlog-canvas-v1";
  const THEME_KEY = "flowlog-theme";
  const PEOPLE_KEY = "flowlog-people-v1";
  const NODE_WIDTH = 252;
  const NODE_CARD_TOP = 32;
  const NODE_CARD_HEIGHT = 160;
  const INLINE_CARD_HEIGHT = 344;
  const MIN_ZOOM = 0.45;
  const MAX_ZOOM = 1.65;

  const statusMeta = {
    todo: { label: "开启", color: "var(--todo)" },
    doing: { label: "进行中", color: "var(--doing)" },
    blocked: { label: "卡点", color: "var(--blocked)" },
    done: { label: "结束", color: "var(--done)" },
  };

  const typeMeta = {
    task: { label: "任务节点", icon: "task" },
    start: { label: "开始节点", icon: "start" },
    supplement: { label: "信息补充", icon: "supplement" },
    end: { label: "结束节点", icon: "end" },
  };

  const icons = {
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20.5 15.1A8.7 8.7 0 0 1 8.9 3.5 8.7 8.7 0 1 0 20.5 15.1Z"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.7-1.7"/></svg>',
    task: '<svg viewBox="0 0 24 24"><path d="M8 6h11M8 12h11M8 18h7"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/></svg>',
    start: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="m10 8 6 4-6 4Z"/></svg>',
    supplement: '<svg viewBox="0 0 24 24"><path d="M5 4h14v13H8l-3 3V4Z"/><path d="M9 8h6M9 12h4"/></svg>',
    end: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>',
    person: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M6 20c.6-3.8 2.6-6 6-6s5.4 2.2 6 6"/></svg>',
    image: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m3 17 5-5 4 4 2-2 7 6"/></svg>',
    pencil: '<svg viewBox="0 0 24 24"><path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.5 7.1 2.8 2.8"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></svg>',
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const canvas = $("#canvasShell");
  const panLayer = $("#panLayer");
  const world = $("#world");
  const nodesLayer = $("#nodesLayer");
  const selectionBox = $("#selectionBox");
  const selectionCount = $("#selectionCount");
  const searchInput = $("#taskSearchInput");
  const searchResults = $("#taskSearchResults");
  const edgePaths = $("#edgePaths");
  const draftEdge = $("#draftEdge");
  const editorPanel = $("#editorPanel");
  const editorEmpty = $("#editorEmpty");
  const editorContent = $("#editorContent");

  let state = loadState();
  let selectedNodeId = null;
  let reportPeriod = "day";
  let pendingNodePosition = null;
  let panSession = null;
  let nodeDragSession = null;
  let connectionSession = null;
  let edgeCancelSession = null;
  let selectionSession = null;
  let toastTimer = null;
  let pendingImageData = "";
  let taskVisibilityMode = "incomplete";
  let fieldUndoSnapshot = null;
  const undoStack = [];
  const expandedGoalNodes = new Set();
  const multiSelectedNodeIds = new Set();

  function defaultState() {
    const date = isoDate(new Date());
    return {
      nodes: [
        { id: "n1", x: 110, y: 270, type: "start", status: "done", priority: 8, title: "数据看板 V2 上线", requester: "陈经理", goal: "上线客户数据看板 V2", note: "", image: "", date },
        { id: "n2", x: 470, y: 270, type: "task", status: "done", title: "梳理数据口径", requester: "王晓", goal: "统一 12 项经营指标的计算口径", note: "指标字典已整理并通过业务确认", image: "", date },
        { id: "n3", x: 830, y: 270, type: "task", status: "doing", title: "完成可视化原型", requester: "陈经理", goal: "输出可用于评审的高保真原型", note: "已完成总览页，正在补充趋势分析页", image: "", date },
        { id: "n4", x: 1190, y: 270, type: "task", status: "blocked", title: "联调权限接口", requester: "周航", goal: "确保不同角色仅查看授权数据", note: "前端鉴权已完成；卡点：等待后端提供测试环境接口", image: "", date },
        { id: "n5", x: 830, y: 570, type: "supplement", status: "done", title: "补充验收要求", requester: "陈经理", goal: "导出报表需要保留筛选条件，并支持 CSV", note: "已补充进验收清单", image: "", date },
        { id: "n6", x: 1550, y: 270, type: "end", status: "todo", title: "发布并复盘", requester: "陈经理", goal: "完成生产发布并记录后续优化项", note: "等待前序任务完成", image: "", date },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2" },
        { id: "e2", from: "n2", to: "n3" },
        { id: "e3", from: "n3", to: "n4" },
        { id: "e4", from: "n3", to: "n5" },
        { id: "e5", from: "n5", to: "n4" },
        { id: "e6", from: "n4", to: "n6" },
      ],
      view: { x: 44, y: 58, zoom: 0.82 },
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.nodes && saved?.edges && saved?.view) {
        saved.nodes = saved.nodes.map((node) => ({
          ...node,
          requester: node.requester || "",
          note: node.note ?? [node.progress, node.blocker].filter(Boolean).join("；"),
          image: node.image || "",
          priority: normalizePriority(node.priority),
        }));
        return saved;
      }
    } catch (error) {
      console.warn("无法读取本地数据", error);
    }
    return defaultState();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn("本地存储空间不足", error);
      showToast("本地空间不足，请删除部分图片后重试");
      return false;
    }
  }

  function normalizeImportedState(payload) {
    const source = payload?.state || payload;
    if (!source || !Array.isArray(source.nodes) || !Array.isArray(source.edges)) {
      throw new Error("文件中没有可识别的任务链数据");
    }

    const ids = new Set();
    const nodes = source.nodes.map((item, index) => {
      const preferredId = String(item?.id || `imported-${index + 1}`);
      let id = preferredId;
      let suffix = 2;
      while (ids.has(id)) id = `${preferredId}-${suffix++}`;
      ids.add(id);
      return {
        id,
        x: Number.isFinite(Number(item?.x)) ? Number(item.x) : 120 + index * 300,
        y: Number.isFinite(Number(item?.y)) ? Number(item.y) : 150,
        type: ["start", "task", "supplement", "end"].includes(item?.type) ? item.type : "task",
        status: Object.prototype.hasOwnProperty.call(statusMeta, item?.status) ? item.status : "todo",
        priority: normalizePriority(item?.priority),
        title: String(item?.title || "未命名任务"),
        requester: String(item?.requester || "").trim(),
        goal: String(item?.goal || ""),
        note: String(item?.note ?? [item?.progress, item?.blocker].filter(Boolean).join("；")),
        image: typeof item?.image === "string" ? item.image : "",
        date: String(item?.date || isoDate(new Date())),
      };
    });

    const adjacency = new Map(nodes.map((node) => [node.id, []]));
    const seenPairs = new Set();
    const edges = [];
    const reaches = (startId, targetId) => {
      const queue = [startId];
      const visited = new Set();
      while (queue.length) {
        const currentId = queue.shift();
        if (currentId === targetId) return true;
        if (visited.has(currentId)) continue;
        visited.add(currentId);
        (adjacency.get(currentId) || []).forEach((nextId) => queue.push(nextId));
      }
      return false;
    };

    source.edges.forEach((item, index) => {
      const from = String(item?.from || "");
      const to = String(item?.to || "");
      const pair = `${from}\u0000${to}`;
      if (!ids.has(from) || !ids.has(to) || from === to || seenPairs.has(pair) || reaches(to, from)) return;
      seenPairs.add(pair);
      adjacency.get(from).push(to);
      edges.push({ id: String(item?.id || `imported-edge-${index + 1}`), from, to });
    });

    const importedView = source.view || {};
    return {
      nodes,
      edges,
      view: {
        x: Number.isFinite(Number(importedView.x)) ? Number(importedView.x) : state.view.x,
        y: Number.isFinite(Number(importedView.y)) ? Number(importedView.y) : state.view.y,
        zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(importedView.zoom) || state.view.zoom)),
      },
    };
  }

  function exportTaskData() {
    const payload = {
      format: "flowlog-task-data",
      version: 1,
      exportedAt: new Date().toISOString(),
      state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Flowlog_任务数据_${isoDate(new Date())}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("任务数据已导出");
  }

  async function importTaskData(file) {
    const payload = JSON.parse(await file.text());
    const importedState = normalizeImportedState(payload);
    if (state.nodes.length && !window.confirm(`导入将替换当前画布的 ${state.nodes.length} 个节点，是否继续？`)) return false;
    pushUndoSnapshot();
    state = importedState;
    selectedNodeId = null;
    multiSelectedNodeIds.clear();
    expandedGoalNodes.clear();
    saveState();
    renderAll();
    showToast(`已导入 ${state.nodes.length} 个节点、${state.edges.length} 条连线`);
    return true;
  }

  function isoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function normalizePriority(value) {
    const legacy = { high: 10, normal: 5, low: 1 };
    const numeric = Object.prototype.hasOwnProperty.call(legacy, value) ? legacy[value] : Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.min(10, Math.max(0, Math.round(numeric)));
  }

  function formatDate(date = new Date()) {
    return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(date);
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function truncate(value, length = 24) {
    const text = value || "暂未填写任务目标";
    return text.length > length ? `${text.slice(0, length)}…` : text;
  }

  function nodeById(id) {
    return state.nodes.find((node) => node.id === id);
  }

  function incomingCount(id) {
    return state.edges.filter((edge) => edge.to === id).length;
  }

  function outgoingCount(id) {
    return state.edges.filter((edge) => edge.from === id).length;
  }

  function derivedType(nodeId) {
    if (incomingCount(nodeId) === 0) return "start";
    if (nodeById(nodeId)?.status === "done") return "end";
    return "task";
  }

  function canConnect(from, to) {
    if (!from || !to || from.id === to.id) return false;
    if (state.edges.some((edge) => edge.from === from.id && edge.to === to.id)) return false;
    return true;
  }

  function connectedNodes(nodeId) {
    const visited = new Set();
    const queue = [nodeId];
    while (queue.length) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      state.edges.forEach((edge) => {
        if (edge.from === current && !visited.has(edge.to)) queue.push(edge.to);
        if (edge.to === current && !visited.has(edge.from)) queue.push(edge.from);
      });
    }
    return state.nodes.filter((node) => visited.has(node.id));
  }

  function chainStart(nodeId) {
    const chain = connectedNodes(nodeId);
    return chain.find((node) => incomingCount(node.id) === 0) || chain[0];
  }

  function chainTaskName(nodeId) {
    return chainStart(nodeId)?.title || nodeById(nodeId)?.title || "未命名任务";
  }

  function effectivePriority(nodeId) {
    const start = chainStart(nodeId);
    return normalizePriority(start?.priority ?? nodeById(nodeId)?.priority ?? 0);
  }

  function effectiveRequester(nodeId) {
    const node = nodeById(nodeId);
    return derivedType(nodeId) !== "start" ? (chainStart(nodeId)?.requester || node?.requester || "") : (node?.requester || "");
  }

  function chainComponents() {
    const visited = new Set();
    const components = [];
    state.nodes.forEach((node) => {
      if (visited.has(node.id)) return;
      const nodes = connectedNodes(node.id);
      nodes.forEach((item) => visited.add(item.id));
      components.push(nodes);
    });
    return components;
  }

  function visibleNodeIds() {
    const visible = new Set();
    chainComponents().forEach((component) => {
      if (component.every((node) => node.status === "done")) return;
      const componentIds = new Set(component.map((node) => node.id));
      const completedBranch = new Set();
      const branchQueue = component.filter((node) => node.status === "done" && state.edges.some((edge) => edge.to === node.id && outgoingCount(edge.from) > 1));
      while (branchQueue.length) {
        const branchNode = branchQueue.shift();
        if (completedBranch.has(branchNode.id)) continue;
        completedBranch.add(branchNode.id);
        state.edges.filter((edge) => edge.from === branchNode.id).forEach((edge) => {
          const next = nodeById(edge.to);
          if (next?.status === "done" && incomingCount(next.id) <= 1) branchQueue.push(next);
        });
      }
      const memo = new Map();
      const leadsToUnfinished = (nodeId, visiting = new Set()) => {
        if (memo.has(nodeId)) return memo.get(nodeId);
        if (visiting.has(nodeId)) return false;
        const node = nodeById(nodeId);
        if (node?.status !== "done") {
          memo.set(nodeId, true);
          return true;
        }
        const nextVisiting = new Set(visiting).add(nodeId);
        const result = state.edges
          .filter((edge) => edge.from === nodeId && componentIds.has(edge.to))
          .some((edge) => leadsToUnfinished(edge.to, nextVisiting));
        memo.set(nodeId, result);
        return result;
      };
      component.forEach((node) => {
        if (!completedBranch.has(node.id) && leadsToUnfinished(node.id)) visible.add(node.id);
      });
    });
    return visible;
  }

  function displayedNodeIds() {
    if (taskVisibilityMode === "all") return new Set(state.nodes.map((node) => node.id));
    if (taskVisibilityMode === "completed") return new Set(state.nodes.filter((node) => node.status === "done").map((node) => node.id));
    return visibleNodeIds();
  }

  function pushUndoSnapshot(snapshot = JSON.stringify(state)) {
    if (undoStack[undoStack.length - 1] === snapshot) return;
    undoStack.push(snapshot);
    if (undoStack.length > 60) undoStack.shift();
  }

  function undoLastAction() {
    const snapshot = undoStack.pop();
    if (!snapshot) {
      showToast("没有可撤销的操作");
      return;
    }
    state = JSON.parse(snapshot);
    selectedNodeId = null;
    multiSelectedNodeIds.clear();
    expandedGoalNodes.clear();
    saveState();
    renderAll();
    showToast("已返回上一步");
  }

  function sortChainsByPriority() {
    const components = chainComponents().filter((component) => component.some((node) => node.status !== "done")).sort((a, b) => {
      const aPriority = effectivePriority(a[0].id);
      const bPriority = effectivePriority(b[0].id);
      if (bPriority !== aPriority) return bPriority - aPriority;
      return effectiveRequester(chainStart(a[0].id)?.id || a[0].id).localeCompare(effectiveRequester(chainStart(b[0].id)?.id || b[0].id), "zh-CN");
    });
    let nextY = 190;
    components.forEach((component) => {
      const minY = Math.min(...component.map((node) => node.y));
      const maxY = Math.max(...component.map((node) => node.y + NODE_CARD_HEIGHT));
      const offsetY = nextY - minY;
      component.forEach((node) => { node.y += offsetY; });
      nextY += Math.max(250, maxY - minY + 130);
    });
    saveState();
  }

  function updateSelectionVisuals() {
    $$(".task-node", nodesLayer).forEach((element) => element.classList.toggle("multi-selected", multiSelectedNodeIds.has(element.dataset.nodeId)));
    if (multiSelectedNodeIds.size > 1) {
      selectionCount.hidden = false;
      selectionCount.textContent = `已选 ${multiSelectedNodeIds.size} 个`;
      selectionCount.style.left = "18px";
      selectionCount.style.top = "60px";
    } else {
      selectionCount.hidden = true;
    }
  }

  function clearMultiSelection() {
    multiSelectedNodeIds.clear();
    updateSelectionVisuals();
  }

  function formatLayout() {
    const visible = displayedNodeIds();
    const components = chainComponents()
      .map((component) => component.filter((node) => visible.has(node.id)))
      .filter((component) => component.length)
      .sort((a, b) => {
        const priorityDiff = effectivePriority(b[0].id) - effectivePriority(a[0].id);
        if (priorityDiff) return priorityDiff;
        return effectiveRequester(chainStart(a[0].id)?.id || a[0].id).localeCompare(effectiveRequester(chainStart(b[0].id)?.id || b[0].id), "zh-CN");
      });
    pushUndoSnapshot();
    const columnPitch = 300;
    const rowPitch = 194;
    const chainGap = 44;
    let chainTop = 150;
    components.forEach((component) => {
      const ids = new Set(component.map((node) => node.id));
      const depth = new Map();
      const roots = component.filter((node) => !state.edges.some((edge) => edge.to === node.id && ids.has(edge.from)));
      const queue = (roots.length ? roots : [component[0]]).map((node) => ({ id: node.id, level: 0 }));
      while (queue.length) {
        const current = queue.shift();
        if ((depth.get(current.id) ?? -1) >= current.level) continue;
        depth.set(current.id, current.level);
        state.edges.filter((edge) => edge.from === current.id && ids.has(edge.to)).forEach((edge) => queue.push({ id: edge.to, level: current.level + 1 }));
      }
      component.forEach((node) => { if (!depth.has(node.id)) depth.set(node.id, 0); });
      const columns = new Map();
      component.forEach((node) => {
        const level = depth.get(node.id);
        if (!columns.has(level)) columns.set(level, []);
        columns.get(level).push(node);
      });
      const hasBranch = component.some((node) => state.edges.filter((edge) => edge.from === node.id && ids.has(edge.to)).length > 1);
      if (!hasBranch) {
        [...columns.entries()].sort((a, b) => a[0] - b[0]).forEach(([level, nodes]) => {
          nodes.sort((a, b) => a.id.localeCompare(b.id));
          nodes.forEach((node, index) => {
            node.x = 120 + (level + index) * columnPitch;
            node.y = chainTop;
          });
        });
        chainTop += NODE_CARD_TOP + NODE_CARD_HEIGHT + chainGap;
        return;
      }

      const maxRegularRows = Math.max(1, ...[...columns.values()].map((nodes) => nodes.filter((node) => node.status !== "blocked").length));
      const maxBlockedRows = Math.max(0, ...[...columns.values()].map((nodes) => nodes.filter((node) => node.status === "blocked").length));
      [...columns.entries()].sort((a, b) => a[0] - b[0]).forEach(([level, nodes]) => {
        nodes.sort((a, b) => effectiveRequester(a.id).localeCompare(effectiveRequester(b.id), "zh-CN") || a.id.localeCompare(b.id));
        const regularNodes = nodes.filter((node) => node.status !== "blocked");
        const blockedNodes = nodes.filter((node) => node.status === "blocked");
        regularNodes.forEach((node, index) => {
          node.x = 120 + level * columnPitch;
          node.y = chainTop + index * rowPitch;
        });
        blockedNodes.forEach((node, index) => {
          node.x = 120 + level * columnPitch;
          node.y = chainTop + maxRegularRows * rowPitch + index * rowPitch;
        });
      });
      chainTop += (maxRegularRows + maxBlockedRows) * rowPitch + chainGap;
    });
    selectedNodeId = null;
    clearMultiSelection();
    saveState();
    renderAll();
    showToast("已按优先级和人名完成排版");
  }

  function matchingChainStarts(query) {
    const cleanQuery = String(query || "").trim().toLocaleLowerCase("zh-CN");
    if (!cleanQuery) return [];
    const visible = visibleNodeIds();
    return chainComponents().map((component) => {
      const activeNodes = component.filter((node) => visible.has(node.id));
      if (!activeNodes.length) return null;
      const start = chainStart(activeNodes[0].id);
      const haystack = activeNodes.flatMap((node) => [node.title, node.goal, node.note, effectiveRequester(node.id)]).join(" ").toLocaleLowerCase("zh-CN");
      return haystack.includes(cleanQuery) ? start : null;
    }).filter(Boolean).sort((a, b) => effectivePriority(b.id) - effectivePriority(a.id) || effectiveRequester(a.id).localeCompare(effectiveRequester(b.id), "zh-CN"));
  }

  function renderSearchResults() {
    const results = matchingChainStarts(searchInput.value);
    if (!searchInput.value.trim()) {
      searchResults.hidden = true;
      searchResults.innerHTML = "";
      return;
    }
    searchResults.hidden = false;
    searchResults.innerHTML = results.length ? results.map((start) => `<button class="search-result-item" data-search-start="${start.id}"><strong>${escapeHtml(start.title)}</strong><span>${escapeHtml(effectiveRequester(start.id) || "未填写来源人")}</span><b>${effectivePriority(start.id)}</b></button>`).join("") : '<div class="search-empty">没有匹配的任务</div>';
  }

  function focusStartNode(nodeId) {
    const node = nodeById(nodeId);
    if (!node) return;
    const rect = canvas.getBoundingClientRect();
    const zoom = Math.max(0.8, Math.min(1.1, state.view.zoom));
    state.view.zoom = zoom;
    state.view.x = rect.width / 2 - (node.x + NODE_WIDTH / 2) * zoom;
    state.view.y = rect.height / 2 - (node.y + NODE_CARD_TOP + NODE_CARD_HEIGHT / 2) * zoom;
    multiSelectedNodeIds.clear();
    multiSelectedNodeIds.add(node.id);
    saveState();
    renderNodes();
    renderEdges();
    renderView();
    updateSelectionVisuals();
    searchResults.hidden = true;
    showToast(`已定位到「${node.title}」`);
  }

  function chainGoal(nodeId) {
    return chainStart(nodeId)?.goal || "待补充任务链目标";
  }

  function progressPathNodes(nodeId) {
    const pathIds = [nodeId];
    let currentId = nodeId;
    const visited = new Set(pathIds);

    while (true) {
      const incoming = state.edges.filter((edge) => edge.to === currentId && !visited.has(edge.from));
      if (incoming.length !== 1) break;
      currentId = incoming[0].from;
      pathIds.unshift(currentId);
      visited.add(currentId);
    }

    currentId = nodeId;
    while (true) {
      const outgoing = state.edges.filter((edge) => edge.from === currentId && !visited.has(edge.to));
      if (outgoing.length !== 1) break;
      currentId = outgoing[0].to;
      pathIds.push(currentId);
      visited.add(currentId);
    }

    return pathIds.map(nodeById).filter(Boolean);
  }

  function chainProgressMarkup(nodeId) {
    const nodes = progressPathNodes(nodeId);
    return `<div class="chain-progress-list">${nodes.map((node, index) => {
      const status = statusMeta[node.status]?.label || "开启";
      const detail = node.note || `任务状态：${status}`;
      return `<div class="chain-progress-item"><b>${index + 1}</b><span>${escapeHtml(detail)}</span></div>`;
    }).join("")}</div>`;
  }

  function knownPeople() {
    let remembered = [];
    try { remembered = JSON.parse(localStorage.getItem(PEOPLE_KEY)) || []; } catch { /* 使用节点中的姓名 */ }
    return [...new Set([...remembered, ...state.nodes.map((node) => node.requester)].map((name) => String(name || "").trim()).filter(Boolean))];
  }

  function rememberPerson(name) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return;
    const names = [...new Set([cleanName, ...knownPeople()])].slice(0, 50);
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(names));
    renderPeopleSuggestions();
  }

  function renderPeopleSuggestions() {
    $("#peopleSuggestions").innerHTML = knownPeople().map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
  }

  function renderAll() {
    renderPeopleSuggestions();
    renderNodes();
    renderEdges();
    renderView();
    renderLegend();
    renderVisibilityButton();
    updateSelectionVisuals();
  }

  function renderVisibilityButton() {
    const labels = { all: "全部任务", completed: "已完成任务", incomplete: "未完成任务" };
    $("#visibilityLabel").textContent = labels[taskVisibilityMode];
    $("#visibilityButton").dataset.mode = taskVisibilityMode;
  }

  function renderNodes() {
    const visible = displayedNodeIds();
    nodesLayer.innerHTML = state.nodes.filter((node) => visible.has(node.id)).map((node) => {
      const nodeType = derivedType(node.id);
      const meta = typeMeta[nodeType] || typeMeta.task;
      const status = statusMeta[node.status] || statusMeta.todo;
      const detail = node.note || "点击补充当前进展或卡点说明";
      const requester = effectiveRequester(node.id) || "未填写来源人";
      const isChild = nodeType !== "start";
      const displayTitle = isChild ? chainTaskName(node.id) : node.title;
      const priority = effectivePriority(node.id);
      const isEditing = selectedNodeId === node.id;
      const goalExpanded = expandedGoalNodes.has(node.id);
      return `
        <article class="task-node node-status-${node.status} type-${nodeType}${isEditing ? " selected inline-editing" : ""}${multiSelectedNodeIds.has(node.id) ? " multi-selected" : ""}" data-node-id="${node.id}" style="left:${node.x}px;top:${node.y}px">
          <button class="node-chain-label" data-toggle-goal="${node.id}" title="点击展开或折叠链目标">${icons.link}<span>链目标 · ${escapeHtml(truncate(chainGoal(node.id), 26))}</span><b>${goalExpanded ? "⌃" : "⌄"}</b></button>
          ${goalExpanded ? `<div class="chain-goal-expanded"><strong>${escapeHtml(chainTaskName(node.id))}</strong><p>${escapeHtml(chainGoal(node.id))}</p>${chainProgressMarkup(node.id)}</div>` : ""}
          <div class="node-card${isEditing ? " inline-edit-card" : ""}">
            <span class="node-accent"></span>
            <button class="node-handle input" data-handle="input" aria-label="连接到此节点"></button>
            <button class="node-handle output" data-handle="output" aria-label="从此节点创建连接"></button>
            <header class="node-header">
              <div class="node-type"><span class="node-type-icon">${icons[meta.icon]}</span>${meta.label}</div>
              <div class="node-header-actions"><span class="priority-badge${priority === 0 ? " priority-zero" : ""}" title="优先级 ${priority}">${priority}</span><button class="node-menu-button edit-node-button" ${isEditing ? `data-close-inline="${node.id}"` : `data-node-menu="${node.id}"`} aria-label="${isEditing ? "完成编辑" : "修改节点"}">${isEditing ? "✓" : icons.pencil}</button></div>
            </header>
            ${isEditing ? inlineEditorMarkup(node, isChild) : `<div class="node-body">
              <div class="node-content-row">
                <div class="node-copy">
                  ${isChild ? `<h3 class="node-title node-main-progress" title="${escapeHtml(detail)}">${escapeHtml(detail)}</h3>` : `<h3 class="node-title" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</h3>`}
                  <span class="node-requester" title="需求来源人">${icons.person}${escapeHtml(requester)}</span>
                  ${nodeType === "start" ? `<p class="node-goal" title="${escapeHtml(node.goal || "暂未填写任务目标")}"><strong>目标</strong> ${escapeHtml(node.goal || "暂未填写任务目标")}</p>` : ""}
                  ${isChild ? `<p class="node-chain-name" title="${escapeHtml(displayTitle)}">任务 · ${escapeHtml(displayTitle)}</p>` : ""}
                </div>
                ${node.image ? `<img class="node-product-image" src="${escapeHtml(node.image)}" alt="${escapeHtml(node.title)}的图片" />` : ""}
              </div>
            </div>
            <footer class="node-footer">
              <span class="status-select-shell"><select class="status-quick-select" data-quick-status="${node.id}" aria-label="设置任务状态">${statusOptions(node.status)}</select></span>
              <span class="node-date">${escapeHtml(node.date || isoDate(new Date()))}</span>
            </footer>`}
          </div>
        </article>`;
    }).join("");
    $$(".inline-textarea", nodesLayer).forEach((textarea) => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }

  function inlineEditorMarkup(node, isChild) {
    const nodeType = derivedType(node.id);
    const displayTitle = isChild ? chainTaskName(node.id) : node.title;
    const requester = effectiveRequester(node.id);
    return `<div class="inline-node-editor">
      <label class="inline-field inline-field-wide"><span>任务名称${isChild ? " · 跟随开始节点" : ""}</span><input class="inline-input" ${isChild ? "readonly" : `data-inline-field="title"`} value="${escapeHtml(displayTitle)}" /></label>
      <div class="inline-field-row">
        <label class="inline-field"><span>需求来源人${isChild ? " · 随开始节点" : ""}</span><input class="inline-input" ${isChild ? "readonly" : 'data-inline-field="requester" list="peopleSuggestions"'} value="${escapeHtml(requester)}" placeholder="姓名" /></label>
        <label class="inline-field"><span>优先级${nodeType === "start" ? "" : " · 随链路"}</span><input class="inline-input inline-priority-input" type="number" min="0" max="10" step="1" ${nodeType === "start" ? 'data-inline-field="priority"' : "readonly"} value="${effectivePriority(node.id)}" /></label>
      </div>
      <label class="inline-field inline-field-wide"><span>任务状态</span><select class="inline-select" data-inline-field="status">${statusOptions(node.status)}</select></label>
      ${nodeType === "start" ? `<label class="inline-field inline-field-wide"><span>任务目标 / 要求</span><textarea class="inline-textarea" data-inline-field="goal" placeholder="填写任务目标">${escapeHtml(node.goal)}</textarea></label>` : ""}
      ${nodeType === "start" ? "" : `<label class="inline-field inline-field-wide"><span>当前进展 / 卡点说明</span><textarea class="inline-textarea" data-inline-field="note" placeholder="记录进展或卡点">${escapeHtml(node.note)}</textarea></label>`}
      <div class="inline-editor-footer">
        <label class="inline-image-button" for="inlineImage-${node.id}">${icons.image}${node.image ? "更换图片" : "添加图片"}</label>
        <input class="inline-image-input" id="inlineImage-${node.id}" data-node-image="${node.id}" type="file" accept="image/*" hidden />
        ${node.image ? `<img class="inline-image-preview" src="${escapeHtml(node.image)}" alt="节点图片" /><button class="inline-action danger" data-remove-inline-image="${node.id}" type="button">移除图片</button>` : ""}
        <button class="inline-action danger" data-delete-inline="${node.id}" type="button">删除节点</button>
      </div>
    </div>`;
  }

  function edgePath(fromNode, toNode) {
    const x1 = fromNode.x + NODE_WIDTH;
    const y1 = fromNode.y + NODE_CARD_TOP + cardHeightFor(fromNode) / 2;
    const x2 = toNode.x;
    const y2 = toNode.y + NODE_CARD_TOP + cardHeightFor(toNode) / 2;
    const gap = x2 - x1;
    const distance = gap >= 0 ? Math.max(24, Math.min(160, gap * 0.45)) : Math.max(100, Math.abs(gap) * 0.55);
    return `M ${x1} ${y1} C ${x1 + distance} ${y1}, ${x2 - distance} ${y2}, ${x2} ${y2}`;
  }

  function renderEdges() {
    const visible = displayedNodeIds();
    edgePaths.innerHTML = state.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to)).map((edge) => {
      const from = nodeById(edge.from);
      const to = nodeById(edge.to);
      if (!from || !to) return "";
      const path = edgePath(from, to);
      const active = selectedNodeId && (edge.from === selectedNodeId || edge.to === selectedNodeId);
      return `<path class="edge-underlay" d="${path}"></path><path class="edge-path${active ? " active" : ""}" d="${path}"></path><path class="edge-shadow" d="${path}" data-edge-id="${edge.id}"></path>`;
    }).join("");
  }

  function renderView() {
    const { x, y, zoom } = state.view;
    panLayer.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    if (CSS.supports("zoom", "1")) {
      world.style.zoom = String(zoom);
      world.style.transform = "none";
    } else {
      world.style.zoom = "1";
      world.style.transform = `scale(${zoom})`;
    }
    canvas.style.setProperty("--grid-size", `${24 * zoom}px`);
    canvas.style.setProperty("--grid-x", `${x % (24 * zoom)}px`);
    canvas.style.setProperty("--grid-y", `${y % (24 * zoom)}px`);
    $("#zoomLabel").textContent = `${Math.round(zoom * 100)}%`;
  }

  function renderLegend() {
    $("#statusLegend").innerHTML = Object.entries(statusMeta).map(([key, value]) => `<span class="legend-item" data-status="${key}"><span class="legend-dot"></span>${value.label}</span>`).join("");
  }

  function renderEditor() {
    const node = nodeById(selectedNodeId);
    editorEmpty.hidden = Boolean(node);
    editorContent.hidden = !node;
    editorPanel.classList.toggle("open", Boolean(node));
    if (!node) {
      editorContent.innerHTML = "";
      return;
    }
    const chain = connectedNodes(node.id).filter((item) => item.goal);
    editorContent.innerHTML = `
      <div class="editor-topline"><span class="editor-kicker">NODE DETAIL</span><button class="editor-close" id="editorClose" aria-label="关闭">×</button></div>
      <h2 class="editor-title">编辑任务节点</h2>
      <div class="editor-section">
        <div class="editor-section-title">基础信息 <span>自动保存</span></div>
        <label class="field-label" for="editTitle">任务名称</label>
        <input class="text-input" id="editTitle" data-field="title" value="${escapeHtml(node.title)}" />
        <label class="field-label" for="editRequester">需求来源人</label>
        <input class="text-input" id="editRequester" data-field="requester" list="peopleSuggestions" value="${escapeHtml(node.requester)}" placeholder="输入姓名，可选择历史记录" />
        <div class="form-row">
          <div><label class="field-label" for="editType">节点类型</label><select class="select-input" id="editType" data-field="type">${typeOptions(node.type)}</select></div>
          <div><label class="field-label" for="editStatus">任务状态</label><select class="select-input" id="editStatus" data-field="status">${statusOptions(node.status)}</select></div>
        </div>
      </div>
      <div class="editor-section">
        <div class="editor-section-title">目标与进展</div>
        <label class="field-label" for="editGoal">任务目标 / 要求</label>
        <textarea class="text-area" id="editGoal" data-field="goal">${escapeHtml(node.goal)}</textarea>
        <label class="field-label" for="editNote">当前进展 / 卡点说明</label>
        <textarea class="text-area" id="editNote" data-field="note" placeholder="记录做到哪一步；有卡点时直接说明原因">${escapeHtml(node.note)}</textarea>
      </div>
      <div class="editor-section">
        <div class="editor-section-title">产品 / 型号图片 <span>${node.image ? "已上传" : "可选"}</span></div>
        <div class="editor-image-box ${node.image ? "has-image" : ""}">
          ${node.image ? `<img src="${escapeHtml(node.image)}" alt="${escapeHtml(node.title)}的图片" />` : `<div class="editor-image-placeholder">${icons.image}<span>添加图片后会直接显示在节点上</span></div>`}
          <div class="editor-image-actions">
            <label class="button button-ghost" for="editNodeImage">${node.image ? "更换图片" : "上传图片"}</label>
            ${node.image ? '<button class="button button-ghost image-remove-button" id="removeNodeImage" type="button">移除</button>' : ""}
          </div>
          <input id="editNodeImage" type="file" accept="image/*" hidden />
        </div>
      </div>
      <div class="editor-section">
        <div class="editor-section-title">整条链路目标汇总 <span>${chain.length} 条</span></div>
        <div class="chain-summary">${chain.map((item) => `<div class="chain-summary-item"><strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.goal)}</div>`).join("") || '<div class="chain-summary-item">暂无目标信息</div>'}</div>
      </div>
      <button class="button button-ghost editor-delete" id="deleteNodeButton">删除该节点</button>`;
  }

  function typeOptions(active) {
    return Object.entries(typeMeta).map(([key, value]) => `<option value="${key}"${key === active ? " selected" : ""}>${value.label}</option>`).join("");
  }

  function statusOptions(active) {
    return Object.entries(statusMeta).map(([key, value]) => `<option value="${key}"${key === active ? " selected" : ""}>${value.label}</option>`).join("");
  }

  function cardHeightFor(node) {
    if (selectedNodeId === node.id) {
      const card = $(`[data-node-id="${node.id}"] .node-card`, nodesLayer);
      return card?.offsetHeight || INLINE_CARD_HEIGHT;
    }
    return NODE_CARD_HEIGHT;
  }

  function selectNode(id) {
    selectedNodeId = id;
    renderNodes();
    renderEdges();
  }

  function canvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - state.view.x) / state.view.zoom,
      y: (clientY - rect.top - state.view.y) / state.view.zoom,
    };
  }

  function openNodeModal(position) {
    pendingNodePosition = position || visibleCenterPoint();
    pendingImageData = "";
    $("#nodeForm").reset();
    $("#newImagePreview").hidden = true;
    $("#newImagePreview").removeAttribute("src");
    $("#newNodeType").value = "task";
    $("#newNodeStatus").value = "todo";
    $("#nodeModal").hidden = false;
    setTimeout(() => $("#newNodeTitle").focus(), 20);
  }

  function closeModal(id) {
    $("#" + id).hidden = true;
  }

  function visibleCenterPoint() {
    const rect = canvas.getBoundingClientRect();
    return canvasPoint(rect.left + rect.width / 2 - NODE_WIDTH / 2, rect.top + rect.height / 2 - 100);
  }

  function createNode(data, position, connectFrom = null) {
    pushUndoSnapshot();
    const id = `n${Date.now().toString(36)}`;
    const node = {
      id,
      x: Math.max(20, Math.round(position.x)),
      y: Math.max(20, Math.round(position.y)),
      type: data.type || "task",
      status: data.status || "todo",
      priority: data.priority === undefined ? (connectFrom ? effectivePriority(connectFrom) : 0) : normalizePriority(data.priority),
      title: data.title || "未命名任务",
      requester: String(data.requester || "").trim(),
      goal: data.goal || "",
      note: data.note || "等待开始",
      image: data.image || "",
      date: isoDate(new Date()),
    };
    state.nodes.push(node);
    rememberPerson(node.requester);
    if (connectFrom && canConnect(nodeById(connectFrom), node)) {
      state.edges.push({ id: `e${Date.now().toString(36)}`, from: connectFrom, to: id });
    }
    saveState();
    selectedNodeId = null;
    renderAll();
    return node;
  }

  function duplicateNode(source) {
    pushUndoSnapshot();
    const id = `n${Date.now().toString(36)}`;
    const duplicate = {
      ...source,
      id,
      x: source.x + 24,
      y: source.y + 24,
      title: `${source.title}（副本）`,
      date: isoDate(new Date()),
    };
    state.nodes.push(duplicate);
    saveState();
    return duplicate;
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("请选择图片文件"));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("图片格式无法识别"));
        image.onload = () => {
          const maxSide = 1000;
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/webp", 0.82));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function deleteNode(id) {
    pushUndoSnapshot();
    state.nodes = state.nodes.filter((node) => node.id !== id);
    state.edges = state.edges.filter((edge) => edge.from !== id && edge.to !== id);
    selectedNodeId = null;
    multiSelectedNodeIds.delete(id);
    saveState();
    renderAll();
    showToast("节点已删除");
  }

  function addEdge(fromId, toId) {
    const from = nodeById(fromId);
    const to = nodeById(toId);
    if (!canConnect(from, to)) {
      showToast("该连接不符合节点规则");
      return false;
    }
    pushUndoSnapshot();
    state.edges.push({ id: `e${Date.now().toString(36)}`, from: fromId, to: toId });
    saveState();
    renderAll();
    showToast("节点已连接");
    return true;
  }

  function deleteEdge(id) {
    pushUndoSnapshot();
    state.edges = state.edges.filter((edge) => edge.id !== id);
    saveState();
    renderEdges();
    showToast("连线已删除");
  }

  function updateView() {
    state.view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.view.zoom));
    renderView();
    saveState();
  }

  function zoomAt(nextZoom, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const oldZoom = state.view.zoom;
    nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const wx = (px - state.view.x) / oldZoom;
    const wy = (py - state.view.y) / oldZoom;
    state.view.x = px - wx * nextZoom;
    state.view.y = py - wy * nextZoom;
    state.view.zoom = nextZoom;
    updateView();
  }

  function fitCanvas() {
    const visible = displayedNodeIds();
    const visibleNodes = state.nodes.filter((node) => visible.has(node.id));
    if (!visibleNodes.length) return;
    const rect = canvas.getBoundingClientRect();
    const minX = Math.min(...visibleNodes.map((node) => node.x));
    const minY = Math.min(...visibleNodes.map((node) => node.y));
    const maxX = Math.max(...visibleNodes.map((node) => node.x + NODE_WIDTH));
    const maxY = Math.max(...visibleNodes.map((node) => node.y + NODE_CARD_TOP + cardHeightFor(node)));
    const zoom = Math.min(1, Math.max(MIN_ZOOM, Math.min((rect.width - 100) / (maxX - minX), (rect.height - 110) / (maxY - minY))));
    state.view.zoom = zoom;
    state.view.x = (rect.width - (maxX - minX) * zoom) / 2 - minX * zoom;
    state.view.y = (rect.height - (maxY - minY) * zoom) / 2 - minY * zoom;
    updateView();
    showToast("已适应全部节点");
  }

  function draftPath(fromNode, point) {
    const x1 = fromNode.x + NODE_WIDTH;
    const y1 = fromNode.y + NODE_CARD_TOP + cardHeightFor(fromNode) / 2;
    const distance = Math.max(70, Math.abs(point.x - x1) * 0.45);
    return `M ${x1} ${y1} C ${x1 + distance} ${y1}, ${point.x - distance} ${point.y}, ${point.x} ${point.y}`;
  }

  function openReport() {
    reportPeriod = "day";
    $$(".report-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.period === "day"));
    updateReport();
    $("#reportModal").hidden = false;
  }

  function reportTitle(period) {
    return { day: "工作日报", week: "工作周报", month: "工作月报" }[period];
  }

  function dateRange(period) {
    const now = new Date();
    if (period === "day") return isoDate(now);
    if (period === "week") {
      const day = now.getDay() || 7;
      const start = new Date(now);
      start.setDate(now.getDate() - day + 1);
      return `${isoDate(start)} — ${isoDate(now)}`;
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function generateReport(period) {
    const done = state.nodes.filter((node) => node.status === "done");
    const doing = state.nodes.filter((node) => node.status === "doing");
    const blocked = state.nodes.filter((node) => node.status === "blocked");
    const todo = state.nodes.filter((node) => node.status === "todo");
    const supplements = state.nodes.filter((node) => node.type === "supplement" && node.goal);
    const source = (node) => node.requester ? `｜来源：${node.requester}` : "";
    const line = (node) => `- ${node.title}${source(node)}${node.note ? `｜${node.note}` : ""}`;
    const unfinishedLine = (node) => `- ${node.title}${source(node)}｜状态：${statusMeta[node.status].label}｜说明：${node.note || "待安排"}`;
    const goals = [...new Set(state.nodes.filter((node) => node.type === "start" && node.goal).map((node) => node.goal))];
    return [
      `${reportTitle(period)}｜${dateRange(period)}`,
      "",
      "一、本期任务目标",
      ...(goals.length ? goals.map((goal) => `- ${goal}`) : ["- 暂未填写"]),
      "",
      `二、已完成（${done.length}）`,
      ...(done.length ? done.map(line) : ["- 暂无已完成任务"]),
      "",
      `三、进行中（${doing.length}）`,
      ...(doing.length ? doing.map(line) : ["- 暂无进行中任务"]),
      "",
      `四、未完成与原因（${blocked.length + todo.length}）`,
      ...(blocked.length + todo.length ? [...blocked, ...todo].map(unfinishedLine) : ["- 本期任务已全部完成"]),
      "",
      "五、需求补充与变更",
      ...(supplements.length ? supplements.map((node) => `- ${node.title}：${node.goal}`) : ["- 本期无补充"]),
      "",
      "六、下一步计划",
      ...[...doing, ...blocked, ...todo].slice(0, 6).map((node) => `- 推进「${node.title}」${node.status === "blocked" && node.note ? `，优先处理：${node.note}` : ""}`),
    ].join("\n");
  }

  function updateReport() {
    const counts = Object.keys(statusMeta).map((key) => state.nodes.filter((node) => node.status === key).length);
    $("#reportOverview").innerHTML = Object.entries(statusMeta).map(([key, meta], index) => `<div class="report-stat"><strong>${counts[index]}</strong><span>${meta.label}任务</span></div>`).join("");
    $("#reportPreview").value = generateReport(reportPeriod);
  }

  function downloadReport() {
    const content = $("#reportPreview").value;
    const blob = new Blob(["\uFEFF" + content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Flowlog_${reportTitle(reportPeriod)}_${isoDate(new Date())}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("报告已导出");
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText($("#reportPreview").value);
      showToast("报告内容已复制");
    } catch {
      $("#reportPreview").select();
      document.execCommand("copy");
      showToast("报告内容已复制");
    }
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    $("#themeButton").innerHTML = theme === "dark" ? icons.sun : icons.moon;
    $("meta[name='theme-color']").content = theme === "dark" ? "#171b18" : "#f4f6f3";
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  canvas.addEventListener("dblclick", (event) => {
    if (event.target.closest(".task-node") || event.target.closest(".zoom-controls") || event.target.closest(".status-legend")) return;
    const point = canvasPoint(event.clientX, event.clientY);
    createNode({ title: "新任务", type: "start", status: "todo", priority: 0, goal: "", note: "" }, { x: point.x - NODE_WIDTH / 2, y: point.y - 100 });
    showToast("节点已创建，点击铅笔图标编辑");
  });

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    zoomAt(state.view.zoom * factor, event.clientX, event.clientY);
  }, { passive: false });

  canvas.addEventListener("pointerdown", (event) => {
    const existingEdge = event.target.closest("[data-edge-id]");
    if (existingEdge && event.button === 0) {
      event.preventDefault();
      event.stopPropagation();
      const session = {
        edgeId: existingEdge.dataset.edgeId,
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        moved: false,
        armed: false,
        visualPath: existingEdge.previousElementSibling,
        timer: null,
      };
      session.timer = setTimeout(() => {
        if (edgeCancelSession !== session) return;
        session.armed = true;
        session.visualPath?.classList.add("canceling");
        showToast("拖到空白画布并松开，可取消这条连线");
      }, 420);
      edgeCancelSession = session;
      return;
    }

    const handle = event.target.closest(".node-handle.output");
    if (handle) {
      event.stopPropagation();
      const nodeEl = handle.closest(".task-node");
      const from = nodeById(nodeEl.dataset.nodeId);
      if (!from) {
        showToast("该节点不能再创建后续连接");
        return;
      }
      connectionSession = { fromId: from.id, point: canvasPoint(event.clientX, event.clientY) };
      draftEdge.hidden = false;
      draftEdge.setAttribute("d", draftPath(from, connectionSession.point));
      return;
    }

    const header = event.target.closest(".node-header");
    const nodeEl = event.target.closest(".task-node");
    if (header && nodeEl && !event.target.closest("button, input, select, textarea, label") && event.button === 0) {
      event.stopPropagation();
      const sourceNode = nodeById(nodeEl.dataset.nodeId);
      const node = event.altKey ? duplicateNode(sourceNode) : sourceNode;
      const point = canvasPoint(event.clientX, event.clientY);
      if (event.altKey) {
        multiSelectedNodeIds.clear();
        multiSelectedNodeIds.add(node.id);
        renderNodes();
        showToast("已复制节点，继续拖动即可放置");
      }
      const dragIds = !event.altKey && multiSelectedNodeIds.has(node.id) ? [...multiSelectedNodeIds] : [node.id];
      if (!multiSelectedNodeIds.has(node.id)) {
        multiSelectedNodeIds.clear();
        multiSelectedNodeIds.add(node.id);
        updateSelectionVisuals();
      }
      nodeDragSession = { ids: dragIds, startX: point.x, startY: point.y, origins: dragIds.map((id) => ({ id, x: nodeById(id).x, y: nodeById(id).y })), moved: false, historySnapshot: JSON.stringify(state) };
      return;
    }

    if (nodeEl && event.target.closest(".node-chain-label, .node-header-actions, .inline-node-editor, .status-quick-select")) return;

    if (nodeEl) return;

    if (event.target.closest(".zoom-controls") || event.target.closest(".status-legend")) return;
    if (event.shiftKey && event.button === 0) {
      const rect = canvas.getBoundingClientRect();
      selectionSession = { startX: event.clientX, startY: event.clientY, rect };
      selectionBox.hidden = false;
      selectionBox.style.left = `${event.clientX - rect.left}px`;
      selectionBox.style.top = `${event.clientY - rect.top}px`;
      selectionBox.style.width = "0px";
      selectionBox.style.height = "0px";
      selectedNodeId = null;
      multiSelectedNodeIds.clear();
      renderNodes();
      canvas.classList.add("selecting");
      return;
    }
    selectedNodeId = null;
    clearMultiSelection();
    renderNodes();
    renderEdges();
    panSession = { clientX: event.clientX, clientY: event.clientY, viewX: state.view.x, viewY: state.view.y };
    canvas.classList.add("panning");
  });

  window.addEventListener("pointermove", (event) => {
    if (edgeCancelSession) {
      edgeCancelSession.currentX = event.clientX;
      edgeCancelSession.currentY = event.clientY;
      edgeCancelSession.moved = Math.hypot(event.clientX - edgeCancelSession.startX, event.clientY - edgeCancelSession.startY) >= 18;
      return;
    }
    if (connectionSession) {
      connectionSession.point = canvasPoint(event.clientX, event.clientY);
      draftEdge.setAttribute("d", draftPath(nodeById(connectionSession.fromId), connectionSession.point));
      return;
    }
    if (nodeDragSession) {
      const point = canvasPoint(event.clientX, event.clientY);
      if (!nodeDragSession.moved) pushUndoSnapshot(nodeDragSession.historySnapshot);
      const deltaX = point.x - nodeDragSession.startX;
      const deltaY = point.y - nodeDragSession.startY;
      nodeDragSession.origins.forEach((origin) => {
        const node = nodeById(origin.id);
        node.x = Math.max(0, origin.x + deltaX);
        node.y = Math.max(0, origin.y + deltaY);
        const nodeEl = $(`[data-node-id="${node.id}"]`, nodesLayer);
        if (nodeEl) {
          nodeEl.style.left = `${node.x}px`;
          nodeEl.style.top = `${node.y}px`;
        }
      });
      nodeDragSession.moved = true;
      renderEdges();
      return;
    }
    if (selectionSession) {
      const { startX, startY, rect } = selectionSession;
      const leftClient = Math.min(startX, event.clientX);
      const topClient = Math.min(startY, event.clientY);
      const rightClient = Math.max(startX, event.clientX);
      const bottomClient = Math.max(startY, event.clientY);
      selectionBox.style.left = `${leftClient - rect.left}px`;
      selectionBox.style.top = `${topClient - rect.top}px`;
      selectionBox.style.width = `${rightClient - leftClient}px`;
      selectionBox.style.height = `${bottomClient - topClient}px`;
      multiSelectedNodeIds.clear();
      $$(".task-node", nodesLayer).forEach((element) => {
        const nodeRect = element.getBoundingClientRect();
        const centerX = nodeRect.left + nodeRect.width / 2;
        const centerY = nodeRect.top + nodeRect.height / 2;
        if (centerX >= leftClient && centerX <= rightClient && centerY >= topClient && centerY <= bottomClient) multiSelectedNodeIds.add(element.dataset.nodeId);
      });
      updateSelectionVisuals();
      return;
    }
    if (panSession) {
      state.view.x = panSession.viewX + event.clientX - panSession.clientX;
      state.view.y = panSession.viewY + event.clientY - panSession.clientY;
      renderView();
    }
  });

  window.addEventListener("pointerup", (event) => {
    if (edgeCancelSession) {
      const session = edgeCancelSession;
      const releaseTarget = document.elementFromPoint(event.clientX, event.clientY);
      const isBlankCanvas = Boolean(releaseTarget?.closest?.("#canvasShell")) && !releaseTarget.closest?.(".task-node, [data-edge-id], .zoom-controls, .status-legend");
      clearTimeout(session.timer);
      session.visualPath?.classList.remove("canceling");
      edgeCancelSession = null;
      if (session.armed && session.moved && isBlankCanvas) deleteEdge(session.edgeId);
      return;
    }
    if (connectionSession) {
      const fromId = connectionSession.fromId;
      const point = connectionSession.point;
      const targetHandle = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".node-handle.input");
      draftEdge.hidden = true;
      draftEdge.setAttribute("d", "");
      connectionSession = null;
      if (targetHandle) {
        addEdge(fromId, targetHandle.closest(".task-node").dataset.nodeId);
      } else {
        const sourceType = derivedType(fromId);
        const inheritedStatus = sourceType === "start" || sourceType === "task" ? "doing" : "todo";
        const newNode = createNode({ title: chainTaskName(fromId), requester: effectiveRequester(fromId), priority: effectivePriority(fromId), type: "task", status: inheritedStatus, goal: "", note: "等待补充任务信息" }, { x: point.x + 20, y: point.y - 100 }, fromId);
        showToast("已自动创建后续节点");
      }
    }
    if (nodeDragSession) {
      saveState();
      nodeDragSession = null;
    }
    if (selectionSession) {
      selectionSession = null;
      selectionBox.hidden = true;
      canvas.classList.remove("selecting");
      updateSelectionVisuals();
      if (multiSelectedNodeIds.size) showToast(`已框选 ${multiSelectedNodeIds.size} 个节点`);
    }
    if (panSession) {
      saveState();
      panSession = null;
      canvas.classList.remove("panning");
    }
  });

  window.addEventListener("pointercancel", () => {
    if (!edgeCancelSession) return;
    clearTimeout(edgeCancelSession.timer);
    edgeCancelSession.visualPath?.classList.remove("canceling");
    edgeCancelSession = null;
  });

  nodesLayer.addEventListener("click", (event) => {
    const goalToggle = event.target.closest("[data-toggle-goal]");
    if (goalToggle) {
      event.stopPropagation();
      const id = goalToggle.dataset.toggleGoal;
      if (expandedGoalNodes.has(id)) expandedGoalNodes.delete(id);
      else expandedGoalNodes.add(id);
      renderNodes();
      return;
    }
    const closeInline = event.target.closest("[data-close-inline]");
    if (closeInline) {
      event.stopPropagation();
      selectedNodeId = null;
      renderNodes();
      renderEdges();
      return;
    }
    const deleteInline = event.target.closest("[data-delete-inline]");
    if (deleteInline) {
      event.stopPropagation();
      deleteNode(deleteInline.dataset.deleteInline);
      return;
    }
    const removeInlineImage = event.target.closest("[data-remove-inline-image]");
    if (removeInlineImage) {
      event.stopPropagation();
      const node = nodeById(removeInlineImage.dataset.removeInlineImage);
      if (node) {
        pushUndoSnapshot();
        node.image = "";
        saveState();
        renderAll();
        showToast("图片已移除");
      }
      return;
    }
    const menu = event.target.closest("[data-node-menu]");
    if (menu) {
      event.stopPropagation();
      selectNode(menu.dataset.nodeMenu);
    }
  });

  nodesLayer.addEventListener("focusin", (event) => {
    if (event.target.dataset.inlineField) fieldUndoSnapshot = JSON.stringify(state);
  });

  nodesLayer.addEventListener("input", (event) => {
    const field = event.target.dataset.inlineField;
    const nodeEl = event.target.closest(".task-node");
    const node = nodeById(nodeEl?.dataset.nodeId);
    if (!field || !node) return;
    if (fieldUndoSnapshot) {
      pushUndoSnapshot(fieldUndoSnapshot);
      fieldUndoSnapshot = null;
    }
    node[field] = field === "priority" ? normalizePriority(event.target.value) : event.target.value;
    saveState();
    if (event.target.matches(".inline-textarea")) {
      event.target.style.height = "auto";
      event.target.style.height = `${event.target.scrollHeight}px`;
      renderEdges();
    }
  });

  nodesLayer.addEventListener("change", (event) => {
    const quickStatusNodeId = event.target.dataset.quickStatus;
    if (quickStatusNodeId) {
      const node = nodeById(quickStatusNodeId);
      if (!node) return;
      pushUndoSnapshot();
      node.status = event.target.value;
      saveState();
      if (!displayedNodeIds().has(node.id)) selectedNodeId = null;
      renderAll();
      showToast(`任务状态已设置为「${statusMeta[node.status].label}」`);
      return;
    }
    const imageNodeId = event.target.dataset.nodeImage;
    if (imageNodeId) {
      const file = event.target.files?.[0];
      const node = nodeById(imageNodeId);
      if (!file || !node) return;
      compressImage(file).then((imageData) => {
        pushUndoSnapshot();
        node.image = imageData;
        saveState();
        renderAll();
        showToast("图片已添加到节点");
      }).catch((error) => showToast(error.message));
      return;
    }
    const field = event.target.dataset.inlineField;
    const nodeEl = event.target.closest(".task-node");
    const node = nodeById(nodeEl?.dataset.nodeId);
    if (!field || !node) return;
    if (fieldUndoSnapshot) {
      pushUndoSnapshot(fieldUndoSnapshot);
      fieldUndoSnapshot = null;
    }
    node[field] = field === "priority" ? normalizePriority(event.target.value) : event.target.value;
    if (field === "priority") event.target.value = String(node[field]);
    if (field === "requester") rememberPerson(node[field]);
    saveState();
    if (field === "status" && !displayedNodeIds().has(node.id)) selectedNodeId = null;
    renderAll();
  });

  edgePaths.addEventListener("dblclick", (event) => {
    const edge = event.target.closest("[data-edge-id]");
    if (edge) deleteEdge(edge.dataset.edgeId);
  });

  editorContent.addEventListener("input", (event) => {
    const field = event.target.dataset.field;
    const node = nodeById(selectedNodeId);
    if (!field || !node) return;
    node[field] = event.target.value;
    saveState();
    renderNodes();
    renderEdges();
  });

  editorContent.addEventListener("change", (event) => {
    if (event.target.id === "editNodeImage") {
      const node = nodeById(selectedNodeId);
      const file = event.target.files?.[0];
      if (!node || !file) return;
      compressImage(file).then((imageData) => {
        node.image = imageData;
        saveState();
        renderAll();
        showToast("图片已添加到节点");
      }).catch((error) => showToast(error.message));
      return;
    }
    const field = event.target.dataset.field;
    const node = nodeById(selectedNodeId);
    if (!field || !node) return;
    node[field] = event.target.value;
    if (field === "requester") rememberPerson(node[field]);
    saveState();
    renderNodes();
    renderEdges();
    renderEditor();
  });

  editorContent.addEventListener("click", (event) => {
    if (event.target.closest("#editorClose")) {
      selectedNodeId = null;
      renderAll();
    }
    if (event.target.closest("#removeNodeImage")) {
      const node = nodeById(selectedNodeId);
      if (node) {
        node.image = "";
        saveState();
        renderAll();
        showToast("图片已移除");
      }
    }
    if (event.target.closest("#deleteNodeButton")) deleteNode(selectedNodeId);
  });

  $("#nodeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createNode({ title: form.get("title"), requester: form.get("requester"), type: form.get("type"), status: form.get("status"), goal: form.get("goal"), note: form.get("note"), image: pendingImageData }, pendingNodePosition || visibleCenterPoint());
    closeModal("nodeModal");
    showToast("节点已创建");
  });

  $("#newNodeImage").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    compressImage(file).then((imageData) => {
      pendingImageData = imageData;
      const preview = $("#newImagePreview");
      preview.src = imageData;
      preview.hidden = false;
      showToast("图片已准备好");
    }).catch((error) => showToast(error.message));
  });

  $$("[data-close-modal]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.closeModal)));
  $$(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("pointerdown", (event) => {
    if (event.target === backdrop) backdrop.hidden = true;
  }));

  $$(".report-tab").forEach((tab) => tab.addEventListener("click", () => {
    reportPeriod = tab.dataset.period;
    $$(".report-tab").forEach((item) => item.classList.toggle("active", item === tab));
    updateReport();
  }));

  $("#addButton").addEventListener("click", () => {
    createNode({ title: "新任务", type: "start", status: "todo", priority: 0, goal: "", note: "" }, visibleCenterPoint());
    showToast("节点已创建，点击铅笔图标编辑");
  });
  $("#railAddButton").addEventListener("click", () => {
    createNode({ title: "新任务", type: "start", status: "todo", priority: 0, goal: "", note: "" }, visibleCenterPoint());
    showToast("节点已创建，点击铅笔图标编辑");
  });
  $("#reportButton").addEventListener("click", openReport);
  $("#dataTransferButton").addEventListener("click", () => {
    const menu = $("#dataTransferMenu");
    menu.hidden = !menu.hidden;
    $("#dataTransferButton").setAttribute("aria-expanded", String(!menu.hidden));
  });
  $("#importDataButton").addEventListener("click", () => {
    $("#dataTransferMenu").hidden = true;
    $("#dataTransferButton").setAttribute("aria-expanded", "false");
    $("#importDataInput").click();
  });
  $("#exportDataButton").addEventListener("click", () => {
    $("#dataTransferMenu").hidden = true;
    $("#dataTransferButton").setAttribute("aria-expanded", "false");
    exportTaskData();
  });
  $("#importDataInput").addEventListener("change", async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await importTaskData(file);
    } catch (error) {
      console.warn("任务数据导入失败", error);
      showToast(error instanceof SyntaxError ? "JSON 文件格式不正确" : (error.message || "任务数据导入失败"));
    } finally {
      input.value = "";
    }
  });
  $("#visibilityButton").addEventListener("click", () => {
    const modes = ["incomplete", "all", "completed"];
    taskVisibilityMode = modes[(modes.indexOf(taskVisibilityMode) + 1) % modes.length];
    selectedNodeId = null;
    multiSelectedNodeIds.clear();
    renderAll();
  });
  $("#layoutButton").addEventListener("click", formatLayout);
  $("#downloadReportButton").addEventListener("click", downloadReport);
  $("#copyReportButton").addEventListener("click", copyReport);
  $("#fitButton").addEventListener("click", fitCanvas);
  $("#resetButton").addEventListener("click", () => {
    pushUndoSnapshot();
    state = defaultState();
    selectedNodeId = null;
    multiSelectedNodeIds.clear();
    expandedGoalNodes.clear();
    saveState();
    renderAll();
    showToast("示例任务链已恢复");
  });
  $("#zoomInButton").addEventListener("click", () => {
    const rect = canvas.getBoundingClientRect();
    zoomAt(state.view.zoom + 0.1, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  $("#zoomOutButton").addEventListener("click", () => {
    const rect = canvas.getBoundingClientRect();
    zoomAt(state.view.zoom - 0.1, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  $("#themeButton").addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

  searchInput.addEventListener("input", renderSearchResults);
  searchInput.addEventListener("focus", renderSearchResults);
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchResults.hidden = true;
      searchInput.blur();
    }
    if (event.key === "Enter") {
      const firstResult = matchingChainStarts(searchInput.value)[0];
      if (firstResult) focusStartNode(firstResult.id);
    }
  });
  searchResults.addEventListener("click", (event) => {
    const result = event.target.closest("[data-search-start]");
    if (result) focusStartNode(result.dataset.searchStart);
  });
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".task-search-shell")) searchResults.hidden = true;
    if (!event.target.closest(".data-transfer")) {
      $("#dataTransferMenu").hidden = true;
      $("#dataTransferButton").setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undoLastAction();
      return;
    }
    if (event.key === "Escape") {
      $("#dataTransferMenu").hidden = true;
      $("#dataTransferButton").setAttribute("aria-expanded", "false");
      $$(".modal-backdrop").forEach((modal) => modal.hidden = true);
      if (connectionSession) {
        connectionSession = null;
        draftEdge.hidden = true;
      }
    }
    if ((event.key === "Delete" || event.key === "Backspace") && selectedNodeId && !event.target.matches("input, textarea, select")) deleteNode(selectedNodeId);
  });

  const preferredTheme = localStorage.getItem(THEME_KEY) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(preferredTheme);
  $("#todayLabel").textContent = formatDate();
  renderAll();
})();
