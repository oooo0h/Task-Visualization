(() => {
  "use strict";

  const STORAGE_KEY = "flowlog-canvas-v1";
  const THEME_KEY = "flowlog-theme";
  const PEOPLE_KEY = "flowlog-people-v1";
  const PEOPLE_HIDDEN_KEY = "flowlog-people-hidden-v1";
  const PEOPLE_STATS_KEY = "flowlog-people-publication-stats-v1";
  const PEOPLE_COUNTED_TASKS_KEY = "flowlog-people-counted-tasks-v1";
  const TEMPLATE_KEY = "flowlog-templates-v1";
  const NODE_WIDTH = 252;
  const NODE_CARD_TOP = 32;
  const NODE_CARD_HEIGHT = 160;
  const INLINE_CARD_HEIGHT = 344;
  const MAX_NODE_IMAGES = 12;
  const MIN_ZOOM = 0.45;
  const MAX_ZOOM = 1.65;
  const COMPLETED_CLEANUP_DAYS = 30;
  const SNAPSHOT_PADDING = 80;
  const SNAPSHOT_TARGET_SCALE = 3;
  const SNAPSHOT_MAX_DIMENSION = 12000;
  const SNAPSHOT_MAX_PIXELS = 90000000;
  const PERSON_INPUT_SELECTOR = 'input[data-person-input="true"], input[list="peopleSuggestions"]';

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
    template: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5M15 16v4M13 18h4"/></svg>',
    pencil: '<svg viewBox="0 0 24 24"><path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.5 7.1 2.8 2.8"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="m14 4 6 6-3.2 1.1-3.4 3.4.5 4.1-1.2 1.2-3.2-5.2-5.2-3.2 1.2-1.2 4.1.5 3.4-3.4L14 4Z"/><path d="M9.5 14.5 4 20"/></svg>',
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
  const templateList = $("#templateList");
  const peopleList = $("#peopleList");

  let state = loadState();
  let templates = loadTemplates();
  let selectedNodeId = null;
  let reportPeriod = "day";
  let pendingNodePosition = null;
  let panSession = null;
  let nodeDragSession = null;
  let connectionSession = null;
  let edgeCancelSession = null;
  let selectionSession = null;
  let toastTimer = null;
  let pendingImageData = [];
  let lightboxImages = [];
  let lightboxIndex = 0;
  let fieldUndoSnapshot = null;
  let serverSyncTimer = null;
  let activePersonInput = null;
  let personSuggestionIndex = -1;
  const pinnedInlineNodeIds = new Set();
  const undoStack = [];
  const expandedGoalNodes = new Set();
  const multiSelectedNodeIds = new Set();
  let collapsedBranchNodes = new Set(Array.isArray(state.view?.collapsedBranches) ? state.view.collapsedBranches.map(String) : []);
  let autoCollapsedBranchNodes = new Set(Array.isArray(state.view?.autoCollapsedBranches) ? state.view.autoCollapsedBranches.map(String) : []);

  function defaultState() {
    const date = isoDate(new Date());
    return {
      nodes: [
        { id: "n1", x: 110, y: 270, type: "start", status: "done", priority: 8, title: "数据看板 V2 上线", requester: "陈经理", goal: "上线客户数据看板 V2", note: "", image: "", date, completedAt: date },
        { id: "n2", x: 470, y: 270, type: "task", status: "done", title: "梳理数据口径", requester: "王晓", goal: "统一 12 项经营指标的计算口径", note: "指标字典已整理并通过业务确认", image: "", date, completedAt: date },
        { id: "n3", x: 830, y: 270, type: "task", status: "doing", title: "完成可视化原型", requester: "陈经理", goal: "输出可用于评审的高保真原型", note: "已完成总览页，正在补充趋势分析页", image: "", date },
        { id: "n4", x: 1190, y: 270, type: "task", status: "blocked", title: "联调权限接口", requester: "周航", goal: "确保不同角色仅查看授权数据", note: "前端鉴权已完成；卡点：等待后端提供测试环境接口", image: "", date },
        { id: "n5", x: 830, y: 570, type: "supplement", status: "done", title: "补充验收要求", requester: "陈经理", goal: "导出报表需要保留筛选条件，并支持 CSV", note: "已补充进验收清单", image: "", date, completedAt: date },
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
      view: { x: 44, y: 58, zoom: 0.82, collapsedBranches: [], autoCollapsedBranches: [] },
    };
  }

  function normalizeImageList(images, legacyImage = "") {
    const values = Array.isArray(images) ? images : [];
    return [...new Set([...values, legacyImage]
      .filter((value) => typeof value === "string" && value.trim()))]
      .slice(0, MAX_NODE_IMAGES);
  }

  function nodeImages(node) {
    return normalizeImageList(node?.images, node?.image);
  }

  function setNodeImages(node, images) {
    const normalized = normalizeImageList(images);
    node.images = normalized;
    node.image = normalized[0] || "";
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.nodes && saved?.edges && saved?.view) {
        saved.nodes = saved.nodes.map((node) => {
          const images = normalizeImageList(node.images, node.image);
          return {
            ...node,
            requester: node.requester || "",
            note: node.note ?? [node.progress, node.blocker].filter(Boolean).join("；"),
            image: images[0] || "",
            images,
            priority: normalizePriority(node.priority),
            completedAt: normalizeCompletionDate(node.completedAt),
          };
        });
        saved.view.collapsedBranches = Array.isArray(saved.view.collapsedBranches) ? saved.view.collapsedBranches.map(String) : [];
        saved.view.autoCollapsedBranches = Array.isArray(saved.view.autoCollapsedBranches) ? saved.view.autoCollapsedBranches.map(String) : [];
        return saved;
      }
    } catch (error) {
      console.warn("无法读取本地数据", error);
    }
    return defaultState();
  }

  function saveState() {
    try {
      cleanupExpiredCompletedChains();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      queueServerStateSync();
      return true;
    } catch (error) {
      console.warn("本地存储空间不足", error);
      showToast("本地空间不足，请删除部分图片后重试");
      return false;
    }
  }

  function queueServerStateSync() {
    clearTimeout(serverSyncTimer);
    serverSyncTimer = setTimeout(() => {
      fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      }).catch(() => {});
    }, 250);
  }

  function loadTemplates() {
    try {
      const saved = JSON.parse(localStorage.getItem(TEMPLATE_KEY));
      if (!Array.isArray(saved)) return [];
      const templatePeople = [];
      const sanitized = saved
        .filter((template) => template && Array.isArray(template.nodes) && Array.isArray(template.edges))
        .slice(0, 50)
        .map((template) => {
          templatePeople.push(template.requester);
          const { requester: _templateRequester, ...templateData } = template;
          return {
            ...templateData,
            nodes: template.nodes.map((node) => {
              templatePeople.push(node.requester);
              const { requester: _nodeRequester, ...nodeData } = node;
              return nodeData;
            }),
          };
        });
      rememberPeople(templatePeople, { promote: false, render: false });
      localStorage.setItem(TEMPLATE_KEY, JSON.stringify(sanitized));
      return sanitized;
    } catch (error) {
      console.warn("无法读取任务模板", error);
      return [];
    }
  }

  function saveTemplates() {
    try {
      localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
      return true;
    } catch (error) {
      console.warn("任务模板保存失败", error);
      showToast("模板保存失败，请删除部分含图片的模板后重试");
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
      const images = normalizeImageList(item?.images, item?.image);
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
        image: images[0] || "",
        images,
        date: String(item?.date || isoDate(new Date())),
        completedAt: normalizeCompletionDate(item?.completedAt),
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
        collapsedBranches: Array.isArray(importedView.collapsedBranches)
          ? importedView.collapsedBranches.map(String).filter((id) => ids.has(id))
          : [],
        autoCollapsedBranches: Array.isArray(importedView.autoCollapsedBranches)
          ? importedView.autoCollapsedBranches.map(String).filter((id) => ids.has(id))
          : [],
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
    syncCollapsedBranchesFromState();
    syncRequesterPublicationStatsFromState();
    selectedNodeId = null;
    pinnedInlineNodeIds.clear();
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

  function normalizeCompletionDate(value) {
    const date = String(value || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
  }

  function normalizePriority(value) {
    const legacy = { high: 10, normal: 5, low: 1 };
    const numeric = Object.prototype.hasOwnProperty.call(legacy, value) ? legacy[value] : Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.min(10, Math.max(0, Math.round(numeric)));
  }

  function childNodes(nodeId) {
    return state.edges.filter((edge) => edge.from === nodeId).map((edge) => nodeById(edge.to)).filter(Boolean);
  }

  function parentNodes(nodeId) {
    return state.edges.filter((edge) => edge.to === nodeId).map((edge) => nodeById(edge.from)).filter(Boolean);
  }

  function branchIsComplete(nodeId, visiting = new Set()) {
    const node = nodeById(nodeId);
    if (!node || node.status !== "done" || visiting.has(nodeId)) return false;
    const nextVisiting = new Set(visiting).add(nodeId);
    return childNodes(nodeId).every((child) => branchIsComplete(child.id, nextVisiting));
  }

  function setNodeStatus(node, nextStatus) {
    const result = {
      changedCount: 0,
      autoCompletedCount: 0,
      reopenedAncestorCount: 0,
      blocked: false,
      waitingCount: 0,
    };
    if (!node || !Object.prototype.hasOwnProperty.call(statusMeta, nextStatus)) return result;

    if (nextStatus === "done") {
      const waitingChildren = childNodes(node.id).filter((child) => !branchIsComplete(child.id));
      if (waitingChildren.length) {
        result.blocked = true;
        result.waitingCount = waitingChildren.length;
        return result;
      }
      const completedAt = isoDate(new Date());
      if (node.status !== "done") {
        node.status = "done";
        node.completedAt = completedAt;
        result.changedCount += 1;
      }
      const queue = parentNodes(node.id);
      const visited = new Set();
      while (queue.length) {
        const parent = queue.shift();
        if (!parent || visited.has(parent.id)) continue;
        visited.add(parent.id);
        const children = childNodes(parent.id);
        if (!children.length || !children.every((child) => branchIsComplete(child.id))) continue;
        if (parent.status !== "done") {
          parent.status = "done";
          parent.completedAt = completedAt;
          result.changedCount += 1;
          result.autoCompletedCount += 1;
        }
        parentNodes(parent.id).forEach((ancestor) => queue.push(ancestor));
      }
      syncAutoCollapsedCompletedBranches();
      return result;
    }

    if (node.status !== nextStatus || node.completedAt) {
      node.status = nextStatus;
      node.completedAt = "";
      result.changedCount += 1;
    }
    const queue = parentNodes(node.id);
    const visited = new Set();
    while (queue.length) {
      const parent = queue.shift();
      if (!parent || visited.has(parent.id)) continue;
      visited.add(parent.id);
      if (parent.status === "done") {
        parent.status = "doing";
        parent.completedAt = "";
        result.changedCount += 1;
        result.reopenedAncestorCount += 1;
      }
      parentNodes(parent.id).forEach((ancestor) => queue.push(ancestor));
    }
    syncAutoCollapsedCompletedBranches();
    return result;
  }

  function statusChangeMessage(node, result) {
    if (result.blocked) return `还有 ${result.waitingCount} 个后续分支未结束，当前节点暂不能结束`;
    if (node.status === "done") {
      return result.autoCompletedCount
        ? `当前分支已结束，${result.autoCompletedCount} 个前置节点已自动结束`
        : "当前分支已结束，其他分支不受影响";
    }
    return result.reopenedAncestorCount
      ? `节点已设为「${statusMeta[node.status].label}」，${result.reopenedAncestorCount} 个前置节点已恢复为进行中`
      : `任务状态已设置为「${statusMeta[node.status].label}」`;
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

  function dateDaysAgo(days, now = new Date()) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - days);
    return isoDate(date);
  }

  function completionDateForCleanup(node) {
    return normalizeCompletionDate(node?.completedAt) || normalizeCompletionDate(node?.date);
  }

  function componentCompletionDate(component) {
    return component
      .map(completionDateForCleanup)
      .filter(Boolean)
      .sort()
      .at(-1) || "";
  }

  function cleanupExpiredCompletedChains(now = new Date()) {
    const cutoff = dateDaysAgo(COMPLETED_CLEANUP_DAYS, now);
    const expiredIds = new Set();
    chainComponents().forEach((component) => {
      if (!component.length || !component.every((node) => node.status === "done")) return;
      const completedAt = componentCompletionDate(component);
      if (completedAt && completedAt < cutoff) component.forEach((node) => expiredIds.add(node.id));
    });
    if (!expiredIds.size) return false;
    state.nodes = state.nodes.filter((node) => !expiredIds.has(node.id));
    state.edges = state.edges.filter((edge) => !expiredIds.has(edge.from) && !expiredIds.has(edge.to));
    collapsedBranchNodes = new Set([...collapsedBranchNodes].filter((id) => !expiredIds.has(id)));
    autoCollapsedBranchNodes = new Set([...autoCollapsedBranchNodes].filter((id) => !expiredIds.has(id)));
    expiredIds.forEach((id) => {
      pinnedInlineNodeIds.delete(id);
      expandedGoalNodes.delete(id);
      multiSelectedNodeIds.delete(id);
    });
    if (expiredIds.has(selectedNodeId)) selectedNodeId = null;
    persistCollapsedBranches();
    return true;
  }

  function createStartTemplate(nodeId) {
    const root = chainStart(nodeId) || nodeById(nodeId);
    if (!root) return;
    const images = nodeImages(root);
    const template = {
      id: `tpl-${Date.now().toString(36)}`,
      name: root.title || "未命名任务",
      priority: effectivePriority(root.id),
      createdAt: isoDate(new Date()),
      nodes: [{
        id: "t1",
        x: 0,
        y: 0,
        title: root.title,
        priority: effectivePriority(root.id),
        goal: root.goal || "",
        note: "",
        image: images[0] || "",
        images,
      }],
      edges: [],
    };
    templates.unshift(template);
    if (!saveTemplates()) {
      templates.shift();
      return;
    }
    renderTemplates();
    showToast(`模板「${template.name}」已创建`);
  }

  function instantiateTemplate(templateId) {
    const template = templates.find((item) => item.id === templateId);
    if (!template?.nodes?.length) return;
    const incomingIds = new Set((template.edges || []).map((edge) => edge.to));
    const source = template.nodes.find((node) => !incomingIds.has(node.id)) || template.nodes[0];
    const rect = canvas.getBoundingClientRect();
    const center = canvasPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const baseX = Math.max(30, center.x - NODE_WIDTH / 2);
    const baseY = Math.max(30, center.y - (NODE_CARD_TOP + NODE_CARD_HEIGHT) / 2);
    const seed = Date.now().toString(36);
    const date = isoDate(new Date());
    const images = normalizeImageList(source.images, source.image);
    const newNode = {
      id: `n${seed}-1`,
      x: Math.round(baseX),
      y: Math.round(baseY),
      type: "start",
      status: "todo",
      priority: normalizePriority(source.priority),
      title: String(source.title || template.name || "未命名任务"),
      requester: "",
      goal: String(source.goal || ""),
      note: "",
      image: images[0] || "",
      images,
      date,
      completedAt: "",
    };
    pushUndoSnapshot();
    state.nodes.push(newNode);
    selectedNodeId = null;
    expandedGoalNodes.clear();
    multiSelectedNodeIds.clear();
    multiSelectedNodeIds.add(newNode.id);
    saveState();
    renderAll();
    showToast("已从模板创建开始节点，可直接编辑或拖动");
  }

  function deleteTemplate(templateId) {
    const template = templates.find((item) => item.id === templateId);
    if (!template || !window.confirm(`确定删除模板「${template.name}」吗？`)) return;
    templates = templates.filter((item) => item.id !== templateId);
    saveTemplates();
    renderTemplates();
    showToast("模板已删除");
  }

  function visibleNodeIds() {
    const today = isoDate(new Date());
    const visible = new Set();
    chainComponents().forEach((component) => {
      const chainIsComplete = component.every((node) => node.status === "done");
      const completedToday = component.some((node) => normalizeCompletionDate(node.completedAt) === today);
      if (!chainIsComplete || completedToday) component.forEach((node) => visible.add(node.id));
    });
    return visible;
  }

  function displayedNodeIds() {
    const visible = visibleNodeIds();
    const hidden = new Set();
    new Set([...collapsedBranchNodes, ...autoCollapsedBranchNodes]).forEach((nodeId) => {
      const queue = state.edges.filter((edge) => edge.from === nodeId).map((edge) => edge.to);
      while (queue.length) {
        const currentId = queue.shift();
        if (hidden.has(currentId)) continue;
        hidden.add(currentId);
        state.edges.filter((edge) => edge.from === currentId).forEach((edge) => queue.push(edge.to));
      }
    });
    hidden.forEach((id) => visible.delete(id));
    return visible;
  }

  function syncCollapsedBranchesFromState() {
    const validIds = new Set(state.nodes.map((node) => node.id));
    collapsedBranchNodes = new Set(
      (Array.isArray(state.view?.collapsedBranches) ? state.view.collapsedBranches : [])
        .map(String)
        .filter((id) => validIds.has(id)),
    );
    autoCollapsedBranchNodes = new Set(
      (Array.isArray(state.view?.autoCollapsedBranches) ? state.view.autoCollapsedBranches : [])
        .map(String)
        .filter((id) => validIds.has(id)),
    );
    syncAutoCollapsedCompletedBranches();
  }

  function persistCollapsedBranches() {
    state.view ||= { x: 0, y: 0, zoom: 1 };
    state.view.collapsedBranches = [...collapsedBranchNodes];
    state.view.autoCollapsedBranches = [...autoCollapsedBranchNodes];
  }

  function isBranchCollapsed(nodeId) {
    return collapsedBranchNodes.has(nodeId) || autoCollapsedBranchNodes.has(nodeId);
  }

  function syncAutoCollapsedCompletedBranches() {
    const validIds = new Set(state.nodes.map((node) => node.id));
    autoCollapsedBranchNodes = new Set([...autoCollapsedBranchNodes]
      .filter((id) => validIds.has(id) && branchIsComplete(id)));
    chainComponents().forEach((component) => {
      if (component.every((node) => node.status === "done")) return;
      component.forEach((fork) => {
        const children = childNodes(fork.id);
        if (children.length < 2) return;
        children.forEach((child) => {
          if (childNodes(child.id).length && branchIsComplete(child.id)) autoCollapsedBranchNodes.add(child.id);
        });
      });
    });
    persistCollapsedBranches();
  }

  function adjustVisibleChainSpacing() {
    const visible = displayedNodeIds();
    const components = chainComponents()
      .map((nodes) => ({ nodes, visibleNodes: nodes.filter((node) => visible.has(node.id)) }))
      .filter((component) => component.visibleNodes.length)
      .sort((a, b) => Math.min(...a.visibleNodes.map((node) => node.y)) - Math.min(...b.visibleNodes.map((node) => node.y)));
    if (!components.length) return;
    const chainGap = 44;
    let nextTop = Math.max(20, Math.min(...components[0].visibleNodes.map((node) => node.y)));
    components.forEach(({ nodes, visibleNodes }) => {
      const minY = Math.min(...visibleNodes.map((node) => node.y));
      const maxY = Math.max(...visibleNodes.map((node) => node.y + NODE_CARD_TOP + cardHeightFor(node)));
      const offsetY = nextTop - minY;
      nodes.forEach((node) => { node.y += offsetY; });
      nextTop += maxY - minY + chainGap;
    });
  }

  function toggleBranchCollapse(nodeId) {
    const childCount = state.edges.filter((edge) => edge.from === nodeId).length;
    if (!childCount) {
      showToast("暂无后续支线，拖动端点可创建连接");
      return;
    }
    pushUndoSnapshot();
    const willCollapse = !isBranchCollapsed(nodeId);
    if (willCollapse) collapsedBranchNodes.add(nodeId);
    else {
      collapsedBranchNodes.delete(nodeId);
      autoCollapsedBranchNodes.delete(nodeId);
    }
    persistCollapsedBranches();
    renderNodes();
    renderEdges();
    adjustVisibleChainSpacing();
    saveState();
    renderAll();
    showToast(willCollapse ? "已折叠后续支线" : "已展开后续支线");
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
    syncCollapsedBranchesFromState();
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
      const maxY = Math.max(...component.map((node) => node.y + cardHeightFor(node)));
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

  function isInlineEditingNode(nodeId) {
    return selectedNodeId === nodeId || pinnedInlineNodeIds.has(nodeId);
  }

  function closeInlineEdit(id) {
    pinnedInlineNodeIds.delete(id);
    if (selectedNodeId === id) selectedNodeId = null;
  }

  function toggleInlinePin(id) {
    const node = nodeById(id);
    if (!node) return;
    if (pinnedInlineNodeIds.has(id)) {
      closeInlineEdit(id);
      renderNodes();
      renderEdges();
      showToast("已取消固定编辑");
      return;
    }
    pinnedInlineNodeIds.add(id);
    selectedNodeId = id;
    multiSelectedNodeIds.clear();
    multiSelectedNodeIds.add(id);
    renderNodes();
    renderEdges();
    updateSelectionVisuals();
    showToast("已固定显示编辑状态");
  }

  function formatLayout() {
    if (selectedNodeId && !pinnedInlineNodeIds.has(selectedNodeId)) {
      if (!finalizeInlineEdit(selectedNodeId)) return;
      selectedNodeId = null;
      renderNodes();
    }
    const visible = displayedNodeIds();
    const today = isoDate(new Date());
    const layoutGroup = (component) => {
      const start = chainStart(component[0]?.id);
      if (component.every((node) => node.status === "done") && normalizeCompletionDate(start?.completedAt) === today) return 2;
      if (component.some((node) => node.status === "blocked")) return 1;
      return 0;
    };
    const components = chainComponents()
      .map((component) => component.filter((node) => visible.has(node.id)))
      .filter((component) => component.length)
      .sort((a, b) => {
        const groupDiff = layoutGroup(a) - layoutGroup(b);
        if (groupDiff) return groupDiff;
        const priorityDiff = effectivePriority(b[0].id) - effectivePriority(a[0].id);
        if (priorityDiff) return priorityDiff;
        const requesterDiff = effectiveRequester(chainStart(a[0].id)?.id || a[0].id).localeCompare(effectiveRequester(chainStart(b[0].id)?.id || b[0].id), "zh-CN");
        if (requesterDiff) return requesterDiff;
        return chainTaskName(a[0].id).localeCompare(chainTaskName(b[0].id), "zh-CN");
      });
    pushUndoSnapshot();
    const columnPitch = 300;
    const chainGap = 44;
    const rowGap = 4;
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
      const childrenById = new Map(component.map((node) => [node.id, []]));
      state.edges.forEach((edge) => {
        if (!ids.has(edge.from) || !ids.has(edge.to)) return;
        const child = nodeById(edge.to);
        if (child) childrenById.get(edge.from)?.push(child);
      });
      childrenById.forEach((children) => children.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)));

      const rowById = new Map();
      let nextRow = 0;
      const assignRows = (node, preferredRow, visiting = new Set()) => {
        if (visiting.has(node.id) || rowById.has(node.id)) return;
        const row = preferredRow ?? nextRow;
        rowById.set(node.id, row);
        nextRow = Math.max(nextRow, row + 1);
        const nextVisiting = new Set(visiting).add(node.id);
        (childrenById.get(node.id) || []).forEach((child, index) => {
          assignRows(child, index === 0 ? row : nextRow, nextVisiting);
        });
      };
      roots.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)).forEach((root, index) => {
        assignRows(root, index === 0 ? 0 : nextRow);
      });
      component.filter((node) => !rowById.has(node.id)).sort((a, b) => a.y - b.y || a.x - b.x).forEach((node) => assignRows(node, nextRow));
      [...component].sort((a, b) => (depth.get(a.id) || 0) - (depth.get(b.id) || 0)).forEach((node) => {
        const parents = state.edges.filter((edge) => edge.to === node.id && ids.has(edge.from)).map((edge) => nodeById(edge.from)).filter(Boolean);
        if (parents.length !== 1 || (childrenById.get(parents[0].id) || []).length !== 1) return;
        rowById.set(node.id, rowById.get(parents[0].id) || 0);
      });
      const usedRows = [...new Set(rowById.values())].sort((a, b) => a - b);
      const normalizedRows = new Map(usedRows.map((row, index) => [row, index]));
      rowById.forEach((row, id) => rowById.set(id, normalizedRows.get(row) || 0));
      nextRow = usedRows.length;
      const rowHeights = Array.from({ length: Math.max(1, nextRow) }, () => NODE_CARD_HEIGHT);
      component.forEach((node) => {
        const row = rowById.get(node.id) || 0;
        rowHeights[row] = Math.max(rowHeights[row], cardHeightFor(node));
      });
      const rowOffsets = [];
      let componentHeight = 0;
      rowHeights.forEach((height, row) => {
        rowOffsets[row] = componentHeight;
        componentHeight += NODE_CARD_TOP + height + rowGap;
      });
      component.forEach((node) => {
        node.x = 120 + (depth.get(node.id) || 0) * columnPitch;
        node.y = chainTop + rowOffsets[rowById.get(node.id) || 0];
      });
      chainTop += componentHeight + chainGap;
    });
    selectedNodeId = null;
    clearMultiSelection();
    saveState();
    renderAll();
    showToast("已按普通、卡点、今日完成任务完成排版");
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
    state.view.y = rect.height / 2 - (node.y + NODE_CARD_TOP + cardHeightFor(node) / 2) * zoom;
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

  function storedPeople() {
    try {
      const saved = JSON.parse(localStorage.getItem(PEOPLE_KEY));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function hiddenPeople() {
    try {
      const saved = JSON.parse(localStorage.getItem(PEOPLE_HIDDEN_KEY));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function storedPersonStats() {
    try {
      const saved = JSON.parse(localStorage.getItem(PEOPLE_STATS_KEY));
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
      return Object.fromEntries(Object.entries(saved)
        .map(([name, count]) => [String(name || "").trim(), Math.max(0, Math.floor(Number(count) || 0))])
        .filter(([name]) => Boolean(name)));
    } catch {
      return {};
    }
  }

  function savePersonStats(stats) {
    try {
      const cleanStats = Object.fromEntries(Object.entries(stats || {})
        .map(([name, count]) => [String(name || "").trim(), Math.max(0, Math.floor(Number(count) || 0))])
        .filter(([name, count]) => Boolean(name) && count > 0));
      localStorage.setItem(PEOPLE_STATS_KEY, JSON.stringify(cleanStats));
    } catch {
      // Source-person statistics are convenience data; task editing should keep working if storage fails.
    }
  }

  function countedRequesterTasks() {
    try {
      const saved = JSON.parse(localStorage.getItem(PEOPLE_COUNTED_TASKS_KEY));
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
      return Object.fromEntries(Object.entries(saved)
        .map(([nodeId, requester]) => [String(nodeId || "").trim(), String(requester || "").trim()])
        .filter(([nodeId, requester]) => Boolean(nodeId) && Boolean(requester)));
    } catch {
      return {};
    }
  }

  function saveCountedRequesterTasks(taskMap) {
    try {
      const cleanMap = Object.fromEntries(Object.entries(taskMap || {})
        .map(([nodeId, requester]) => [String(nodeId || "").trim(), String(requester || "").trim()])
        .filter(([nodeId, requester]) => Boolean(nodeId) && Boolean(requester)));
      localStorage.setItem(PEOPLE_COUNTED_TASKS_KEY, JSON.stringify(cleanMap));
    } catch {
      // Source-person statistics are convenience data; task editing should keep working if storage fails.
    }
  }

  function cleanPeople(values) {
    return [...new Set(values.map((name) => String(name || "").trim()).filter(Boolean))];
  }

  function rawKnownPeople() {
    return cleanPeople([...storedPeople(), ...state.nodes.map((node) => node.requester)]);
  }

  function knownPeople() {
    const hidden = new Set(hiddenPeople());
    return rawKnownPeople().filter((name) => !hidden.has(name));
  }

  function taskPublicationRequester(node) {
    const requester = String(node?.requester || "").trim();
    return node && requester && incomingCount(node.id) === 0 ? requester : "";
  }

  function livePublicationCounts() {
    return state.nodes.reduce((counts, node) => {
      const requester = taskPublicationRequester(node);
      if (requester) counts[requester] = (counts[requester] || 0) + 1;
      return counts;
    }, {});
  }

  function trackRequesterPublication(node) {
    const requester = taskPublicationRequester(node);
    if (!requester) return false;
    const taskMap = countedRequesterTasks();
    const previousRequester = String(taskMap[node.id] || "").trim();
    if (previousRequester === requester) return false;
    const stats = storedPersonStats();
    if (previousRequester) {
      stats[previousRequester] = Math.max(0, (Number(stats[previousRequester]) || 0) - 1);
    }
    stats[requester] = (Number(stats[requester]) || 0) + 1;
    taskMap[node.id] = requester;
    savePersonStats(stats);
    saveCountedRequesterTasks(taskMap);
    return true;
  }

  function syncRequesterPublicationStatsFromState() {
    const taskMap = countedRequesterTasks();
    const stats = storedPersonStats();
    let changed = false;
    state.nodes.forEach((node) => {
      const requester = taskPublicationRequester(node);
      if (!requester || taskMap[node.id] === requester) return;
      const previousRequester = String(taskMap[node.id] || "").trim();
      if (previousRequester) stats[previousRequester] = Math.max(0, (Number(stats[previousRequester]) || 0) - 1);
      stats[requester] = (Number(stats[requester]) || 0) + 1;
      taskMap[node.id] = requester;
      changed = true;
    });
    if (!changed) return false;
    savePersonStats(stats);
    saveCountedRequesterTasks(taskMap);
    return true;
  }

  function trackRequesterInputPublication(input) {
    const inlineNodeId = input?.closest?.(".task-node")?.dataset.nodeId;
    const editorNodeId = input?.closest?.("#editorContent") ? selectedNodeId : "";
    const node = nodeById(inlineNodeId || editorNodeId);
    return trackRequesterPublication(node);
  }

  function saveHiddenPeople(names) {
    try {
      localStorage.setItem(PEOPLE_HIDDEN_KEY, JSON.stringify(cleanPeople(names).slice(0, 100)));
    } catch {
      // 隐藏历史来源人只是辅助偏好，失败时不阻断任务编辑。
    }
  }

  function savePeople(names, shouldRender = true) {
    try {
      localStorage.setItem(PEOPLE_KEY, JSON.stringify(cleanPeople(names).slice(0, 50)));
    } catch {
      // 来源人记忆只是辅助功能，存储空间不足时不阻断任务编辑。
    }
    if (shouldRender) renderPeopleUI();
  }

  function rememberPeople(values, options = {}) {
    const cleanNames = cleanPeople(values);
    if (!cleanNames.length) return;
    const hidden = hiddenPeople().filter((name) => !cleanNames.includes(name));
    saveHiddenPeople(hidden);
    const current = knownPeople();
    const merged = options.promote === false ? [...current, ...cleanNames] : [...cleanNames, ...current];
    savePeople(merged, options.render !== false);
  }

  function rememberPerson(name) {
    rememberPeople([name]);
  }

  function recentPerson() {
    return knownPeople()[0] || "";
  }

  function renderPeopleSuggestions() {
    $("#peopleSuggestions").innerHTML = knownPeople().map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
  }

  function renderPeopleManager() {
    if (!peopleList) return;
    const people = knownPeople();
    const count = $("#peopleCount");
    const stats = storedPersonStats();
    const liveCounts = livePublicationCounts();
    const peopleWithCounts = people
      .map((name, index) => ({
        name,
        index,
        taskCount: Math.max(Number(stats[name]) || 0, Number(liveCounts[name]) || 0),
      }))
      .sort((a, b) => (b.taskCount - a.taskCount) || (a.index - b.index));
    if (count) count.textContent = String(people.length);
    peopleList.innerHTML = people.length
      ? peopleWithCounts.map(({ name, taskCount }) => {
        return `<div class="people-item"><span title="${escapeHtml(name)}">${escapeHtml(name)}</span><b class="people-publish-count" title="任务发布次数">${taskCount} 次</b><button type="button" data-delete-person="${escapeHtml(name)}" aria-label="删除 ${escapeHtml(name)}">删除</button></div>`;
      }).join("")
      : `<div class="people-empty">暂无历史来源人</div>`;
  }

  function renderPeopleUI() {
    renderPeopleSuggestions();
    renderPeopleManager();
  }

  function removeRememberedPerson(name) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return;
    saveHiddenPeople([cleanName, ...hiddenPeople()]);
    savePeople(storedPeople().filter((item) => item !== cleanName), false);
    renderPeopleUI();
    showToast(`已移除来源人「${cleanName}」`);
  }

  function isPersonInput(target) {
    return Boolean(target?.matches?.(PERSON_INPUT_SELECTOR));
  }

  function personSuggestionBox() {
    let box = $("#personSuggestionBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "personSuggestionBox";
      box.className = "person-suggestion-box";
      box.setAttribute("role", "listbox");
      box.hidden = true;
      document.body.appendChild(box);
    }
    return box;
  }

  function personSuggestionItems(input) {
    const query = String(input?.value || "").trim().toLocaleLowerCase("zh-CN");
    const people = knownPeople();
    if (!query) return people.slice(0, 8);
    const startsWith = [];
    const includes = [];
    people.forEach((name) => {
      const lowerName = name.toLocaleLowerCase("zh-CN");
      if (lowerName.startsWith(query)) startsWith.push(name);
      else if (lowerName.includes(query)) includes.push(name);
    });
    return [...startsWith, ...includes].slice(0, 8);
  }

  function highlightedPersonName(name, query) {
    const text = String(name || "");
    const cleanQuery = String(query || "").trim();
    if (!cleanQuery) return escapeHtml(text);
    const lowerText = text.toLocaleLowerCase("zh-CN");
    const lowerQuery = cleanQuery.toLocaleLowerCase("zh-CN");
    const index = lowerText.indexOf(lowerQuery);
    if (index < 0) return escapeHtml(text);
    return `${escapeHtml(text.slice(0, index))}<mark>${escapeHtml(text.slice(index, index + cleanQuery.length))}</mark>${escapeHtml(text.slice(index + cleanQuery.length))}`;
  }

  function positionPersonSuggestionBox(input, box) {
    const rect = input.getBoundingClientRect();
    const width = Math.max(rect.width, 168);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const belowSpace = window.innerHeight - rect.bottom - 8;
    const aboveSpace = rect.top - 8;
    const maxHeight = Math.min(220, Math.max(112, Math.max(belowSpace, aboveSpace)));
    box.style.left = `${left}px`;
    box.style.width = `${width}px`;
    box.style.maxHeight = `${maxHeight}px`;
    if (belowSpace >= 112 || belowSpace >= aboveSpace) {
      box.style.top = `${rect.bottom + 4}px`;
      box.style.bottom = "auto";
    } else {
      box.style.top = "auto";
      box.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    }
  }

  function updatePersonSuggestionActive() {
    const box = personSuggestionBox();
    const options = $$("[data-person-suggestion]", box);
    options.forEach((option, index) => {
      const active = index === personSuggestionIndex;
      option.classList.toggle("active", active);
      option.setAttribute("aria-selected", String(active));
      if (active) option.scrollIntoView({ block: "nearest" });
    });
  }

  function showPersonSuggestions(input) {
    if (!isPersonInput(input) || input.readOnly || input.disabled) {
      hidePersonSuggestions();
      return;
    }
    renderPeopleSuggestions();
    const items = personSuggestionItems(input);
    const box = personSuggestionBox();
    activePersonInput = input;
    if (!items.length) {
      hidePersonSuggestions();
      return;
    }
    personSuggestionIndex = Math.min(Math.max(personSuggestionIndex, -1), items.length - 1);
    const query = String(input.value || "").trim();
    box.innerHTML = `<div class="person-suggestion-title">历史来源人</div>${items.map((name, index) => `
      <button class="person-suggestion-option" type="button" role="option" data-person-suggestion="${escapeHtml(name)}" aria-selected="${index === personSuggestionIndex}">
        <span>${highlightedPersonName(name, query)}</span>
        <small>点击选择</small>
      </button>
    `).join("")}`;
    positionPersonSuggestionBox(input, box);
    box.hidden = false;
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", "personSuggestionBox");
    input.setAttribute("aria-expanded", "true");
    updatePersonSuggestionActive();
  }

  function hidePersonSuggestions() {
    const input = activePersonInput;
    const box = personSuggestionBox();
    box.hidden = true;
    personSuggestionIndex = -1;
    activePersonInput = null;
    if (input) {
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }
  }

  function choosePersonSuggestion(name) {
    const input = activePersonInput;
    if (!input) return;
    input.value = name;
    rememberPerson(name);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    trackRequesterInputPublication(input);
    hidePersonSuggestions();
    input.focus();
  }

  function renderTemplates() {
    $("#templateCount").textContent = String(templates.length);
    templateList.innerHTML = templates.length ? templates.map((template) => {
      return `<article class="template-card">
        <div class="template-card-top"><h3 title="${escapeHtml(template.name || "未命名模板")}">${escapeHtml(template.name || "未命名模板")}</h3><span class="template-priority" title="优先级">${normalizePriority(template.priority)}</span></div>
        <p class="template-card-meta">开始节点模板 · 使用后填写任务来源人</p>
        <div class="template-card-actions">
          <button class="template-use-button" type="button" data-use-template="${escapeHtml(template.id)}">使用模板</button>
          <button class="template-delete-button" type="button" data-delete-template="${escapeHtml(template.id)}" aria-label="删除模板"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg></button>
        </div>
      </article>`;
    }).join("") : `<div class="template-empty">${icons.template}<span>还没有任务模板<br>编辑节点时点击“创建模板”</span></div>`;
  }

  function renderAll() {
    renderPeopleUI();
    renderTemplates();
    renderNodes();
    renderEdges();
    renderView();
    renderLegend();
    updateSelectionVisuals();
  }

  function editableImageGalleryMarkup(node) {
    const images = nodeImages(node);
    if (!images.length) return "";
    return `<div class="inline-image-gallery" aria-label="节点图片，共 ${images.length} 张">
      ${images.map((image, index) => `<div class="inline-image-item">
        <button class="inline-image-open" type="button" data-preview-node-images="${node.id}" data-image-index="${index}" aria-label="放大查看第 ${index + 1} 张图片">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(node.title)}的图片 ${index + 1}" />
          <span class="inline-image-order">${index + 1} / ${images.length}</span>
          <span class="inline-image-zoom-hint">点击放大</span>
        </button>
        <button class="inline-image-remove" type="button" data-remove-node-image="${node.id}" data-image-index="${index}" aria-label="移除第 ${index + 1} 张图片">×</button>
      </div>`).join("")}
    </div>`;
  }

  function renderNodes() {
    const visible = displayedNodeIds();
    nodesLayer.innerHTML = state.nodes.filter((node) => visible.has(node.id)).map((node) => {
      const nodeType = derivedType(node.id);
      const status = statusMeta[node.status] || statusMeta.todo;
      const detail = node.note || "点击补充当前进展或卡点说明";
      const requester = effectiveRequester(node.id) || "未填写来源人";
      const isChild = nodeType !== "start";
      const displayTitle = isChild ? chainTaskName(node.id) : node.title;
      const priority = effectivePriority(node.id);
      const isEditing = isInlineEditingNode(node.id);
      const isPinnedEditing = pinnedInlineNodeIds.has(node.id);
      const goalExpanded = expandedGoalNodes.has(node.id);
      const hasBranches = outgoingCount(node.id) > 0;
      const branchCollapsed = isBranchCollapsed(node.id);
      const displayDate = node.status === "done" && node.completedAt ? node.completedAt : (node.date || isoDate(new Date()));
      const images = nodeImages(node);
      return `
        <article class="task-node node-status-${node.status} type-${nodeType}${isEditing ? " selected inline-editing" : ""}${isPinnedEditing ? " inline-pinned" : ""}${multiSelectedNodeIds.has(node.id) ? " multi-selected" : ""}" data-node-id="${node.id}" style="left:${node.x}px;top:${node.y}px">
          <button class="node-chain-label" data-toggle-goal="${node.id}" title="点击展开或折叠链目标">${icons.link}<span>链目标 · ${escapeHtml(truncate(chainGoal(node.id), 26))}</span><b>${goalExpanded ? "⌃" : "⌄"}</b></button>
          ${goalExpanded ? `<div class="chain-goal-expanded"><strong>${escapeHtml(chainTaskName(node.id))}</strong><p>${escapeHtml(chainGoal(node.id))}</p>${chainProgressMarkup(node.id)}</div>` : ""}
          <div class="node-card${isEditing ? " inline-edit-card" : ""}">
            <span class="node-accent"></span>
            <button class="node-handle input" data-handle="input" aria-label="连接到此节点"></button>
            <button class="node-handle output${hasBranches ? " has-branch" : ""}${branchCollapsed ? " branch-collapsed" : ""}" data-handle="output" aria-label="${hasBranches ? (branchCollapsed ? "展开后续支线" : "折叠后续支线") : "拖动创建后续连接"}" title="${hasBranches ? "单击折叠/展开支线，拖动创建连线" : "拖动创建后续连线"}"></button>
            <header class="node-header">
              <div class="node-type node-header-requester" title="任务来源人"><span class="node-type-icon">${icons.person}</span>${escapeHtml(requester)}</div>
              <div class="node-header-actions"><span class="priority-badge${priority === 0 ? " priority-zero" : ""}" title="优先级 ${priority}">${priority}</span><button class="node-menu-button edit-node-button${isEditing ? " inline-pin-button" : ""}${isPinnedEditing ? " inline-pin-active" : ""}" ${isEditing ? `data-toggle-inline-pin="${node.id}" aria-pressed="${isPinnedEditing}"` : `data-node-menu="${node.id}"`} aria-label="${isEditing ? (isPinnedEditing ? "取消固定编辑" : "固定显示编辑") : "修改节点"}" title="${isEditing ? (isPinnedEditing ? "取消固定编辑" : "固定显示编辑") : "修改节点"}">${isEditing ? icons.pin : icons.pencil}</button></div>
            </header>
            ${isEditing ? inlineEditorMarkup(node, isChild) : `<div class="node-body">
              <div class="node-content-row">
                <div class="node-copy">
                  ${isChild ? `<h3 class="node-title node-main-progress" title="${escapeHtml(detail)}">${escapeHtml(detail)}</h3>` : `<h3 class="node-title" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</h3>`}
                  ${nodeType === "start" ? `<p class="node-goal" title="${escapeHtml(node.goal || "暂未填写任务目标")}"><strong>目标</strong> ${escapeHtml(node.goal || "暂未填写任务目标")}</p>` : ""}
                  ${isChild ? `<p class="node-chain-name" title="${escapeHtml(displayTitle)}">任务 · ${escapeHtml(displayTitle)}</p>` : ""}
                </div>
                ${images.length ? `<button class="node-image-summary" type="button" data-preview-node-images="${node.id}" data-image-index="0" aria-label="查看节点图片，共 ${images.length} 张"><img class="node-product-image" src="${escapeHtml(images[0])}" alt="${escapeHtml(node.title)}的图片" />${images.length > 1 ? `<span>+${images.length - 1}</span>` : ""}</button>` : ""}
              </div>
            </div>
            <footer class="node-footer">
              <span class="status-select-shell"><select class="status-quick-select" data-quick-status="${node.id}" aria-label="设置任务状态">${statusOptions(node.status)}</select></span>
              <span class="node-date">${escapeHtml(displayDate)}</span>
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
    const images = nodeImages(node);
    return `<div class="inline-node-editor" spellcheck="false" autocorrect="off" autocapitalize="off">
      <label class="inline-field inline-field-wide" data-required-field="title"><span>任务名称${isChild ? " · 跟随开始节点" : ""}</span><input class="inline-input" ${isChild ? "readonly" : `data-inline-field="title"`} value="${escapeHtml(displayTitle)}" placeholder="请输入任务名称" aria-required="true" spellcheck="false" /><small class="inline-field-error">任务名称不能为空</small></label>
      <div class="inline-field-row">
        <label class="inline-field" data-required-field="requester"><span>需求来源人${isChild ? " · 随开始节点" : ""}</span><input class="inline-input" ${isChild ? "readonly" : 'data-inline-field="requester" data-person-input="true" autocomplete="off"'} value="${escapeHtml(requester)}" placeholder="请输入任务来源人" aria-required="true" spellcheck="false" /><small class="inline-field-error">任务来源人不能为空</small></label>
        <label class="inline-field"><span>优先级${nodeType === "start" ? "" : " · 随链路"}</span><input class="inline-input inline-priority-input" type="number" min="0" max="10" step="1" ${nodeType === "start" ? 'data-inline-field="priority"' : "readonly"} value="${effectivePriority(node.id)}" /></label>
      </div>
      ${nodeType === "start" ? `<label class="inline-field inline-field-wide"><span>任务目标 / 要求</span><textarea class="inline-textarea" data-inline-field="goal" placeholder="填写任务目标" spellcheck="false">${escapeHtml(node.goal)}</textarea></label>` : ""}
      ${nodeType === "start" ? "" : `<label class="inline-field inline-field-wide"><span>当前进展 / 卡点说明</span><textarea class="inline-textarea" data-inline-field="note" placeholder="记录进展或卡点" spellcheck="false">${escapeHtml(node.note)}</textarea></label>`}
      <label class="inline-image-dropzone" for="inlineImage-${node.id}">
        <span class="inline-image-dropzone-icon">${icons.image}</span>
        <span><strong>${images.length ? "继续添加图片" : "添加图片"}</strong><small>点击选择图片，或在上方文本框 Ctrl + V 粘贴图片</small></span>
      </label>
      <input class="inline-image-input" id="inlineImage-${node.id}" data-node-image="${node.id}" type="file" accept="image/*" multiple hidden />
      ${editableImageGalleryMarkup(node)}
      <div class="inline-editor-footer">
        <button class="inline-action template-create-action" data-create-template="${node.id}" type="button">${icons.template}创建模板</button>
        <button class="inline-action danger" data-delete-inline="${node.id}" type="button">删除节点</button>
      </div>
    </div>`;
  }

  function edgeGeometry(fromNode, toNode) {
    const x1 = fromNode.x + NODE_WIDTH;
    const y1 = fromNode.y + NODE_CARD_TOP + cardHeightFor(fromNode) / 2;
    const x2 = toNode.x;
    const y2 = toNode.y + NODE_CARD_TOP + cardHeightFor(toNode) / 2;
    const gap = x2 - x1;
    const distance = gap >= 0 ? Math.max(24, Math.min(160, gap * 0.45)) : Math.max(100, Math.abs(gap) * 0.55);
    return {
      x1,
      y1,
      x2,
      y2,
      path: `M ${x1} ${y1} C ${x1 + distance} ${y1}, ${x2 - distance} ${y2}, ${x2} ${y2}`,
    };
  }

  function nodeEdgeColor(node) {
    return statusMeta[node?.status]?.color || statusMeta.todo.color;
  }

  function renderEdges() {
    const visible = displayedNodeIds();
    edgePaths.innerHTML = state.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to)).map((edge, index) => {
      const from = nodeById(edge.from);
      const to = nodeById(edge.to);
      if (!from || !to) return "";
      const geometry = edgeGeometry(from, to);
      const gradientId = `edge-gradient-${index}`;
      const arrowId = `edge-arrow-${index}`;
      const fromColor = nodeEdgeColor(from);
      const toColor = nodeEdgeColor(to);
      const active = selectedNodeId && (edge.from === selectedNodeId || edge.to === selectedNodeId);
      const completed = to.status === "done";
      return `<defs>
        <linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" x1="${geometry.x1}" y1="${geometry.y1}" x2="${geometry.x2}" y2="${geometry.y2}">
          <stop offset="0%" style="stop-color:${fromColor}"></stop>
          <stop offset="100%" style="stop-color:${toColor}"></stop>
        </linearGradient>
        <marker id="${arrowId}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0 0 8 4 0 8Z" style="fill:${toColor}"></path>
        </marker>
      </defs><path class="edge-underlay" d="${geometry.path}"></path><path class="edge-path${completed ? " completed" : ""}${active ? " active" : ""}" d="${geometry.path}" style="stroke:url(#${gradientId});marker-end:url(#${arrowId})"></path><path class="edge-shadow" d="${geometry.path}" data-edge-id="${edge.id}"></path>`;
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
    const images = nodeImages(node);
    editorContent.innerHTML = `
      <div class="editor-topline"><span class="editor-kicker">NODE DETAIL</span><button class="editor-close" id="editorClose" aria-label="关闭">×</button></div>
      <h2 class="editor-title">编辑任务节点</h2>
      <div class="editor-section">
        <div class="editor-section-title">基础信息 <span>自动保存</span></div>
        <label class="field-label" for="editTitle">任务名称</label>
        <input class="text-input" id="editTitle" data-field="title" value="${escapeHtml(node.title)}" spellcheck="false" />
        <label class="field-label" for="editRequester">需求来源人</label>
        <input class="text-input" id="editRequester" data-field="requester" data-person-input="true" autocomplete="off" value="${escapeHtml(node.requester)}" placeholder="输入姓名，可选择历史记录" spellcheck="false" />
        <div class="form-row">
          <div><label class="field-label" for="editType">节点类型</label><select class="select-input" id="editType" data-field="type">${typeOptions(node.type)}</select></div>
          <div><label class="field-label" for="editStatus">任务状态</label><select class="select-input" id="editStatus" data-field="status">${statusOptions(node.status)}</select></div>
        </div>
      </div>
      <div class="editor-section">
        <div class="editor-section-title">目标与进展</div>
        <label class="field-label" for="editGoal">任务目标 / 要求</label>
        <textarea class="text-area" id="editGoal" data-field="goal" spellcheck="false">${escapeHtml(node.goal)}</textarea>
        <label class="field-label" for="editNote">当前进展 / 卡点说明</label>
        <textarea class="text-area" id="editNote" data-field="note" placeholder="记录做到哪一步；有卡点时直接说明原因" spellcheck="false">${escapeHtml(node.note)}</textarea>
      </div>
      <div class="editor-section">
        <div class="editor-section-title">产品 / 型号图片 <span>${images.length ? `${images.length} 张` : "可选"}</span></div>
        <div class="editor-image-box ${images.length ? "has-image" : ""}">
          ${images.length ? editableImageGalleryMarkup(node) : `<div class="editor-image-placeholder">${icons.image}<span>可添加多张图片，点击图片可放大查看</span></div>`}
          <div class="editor-image-actions">
            <label class="button button-ghost" for="editNodeImage">${images.length ? "继续添加图片" : "上传图片"}</label>
          </div>
          <input id="editNodeImage" type="file" accept="image/*" multiple hidden />
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
    const card = $(`[data-node-id="${node.id}"] .node-card`, nodesLayer);
    return card?.offsetHeight || (isInlineEditingNode(node.id) ? INLINE_CARD_HEIGHT : NODE_CARD_HEIGHT);
  }

  function validateInlineRequiredFields(node) {
    if (!node || derivedType(node.id) !== "start") return true;
    const nodeEl = $(`[data-node-id="${node.id}"]`, nodesLayer);
    const missingFields = ["title", "requester"].filter((field) => !String(node[field] || "").trim());
    ["title", "requester"].forEach((field) => {
      const fieldEl = nodeEl?.querySelector(`[data-required-field="${field}"]`);
      const input = fieldEl?.querySelector(".inline-input");
      const hasError = missingFields.includes(field);
      fieldEl?.classList.toggle("has-error", hasError);
      input?.setAttribute("aria-invalid", String(hasError));
    });
    if (!missingFields.length) return true;
    nodeEl?.classList.remove("validation-shake");
    if (nodeEl) void nodeEl.offsetWidth;
    nodeEl?.classList.add("validation-shake");
    setTimeout(() => nodeEl?.classList.remove("validation-shake"), 520);
    nodeEl?.querySelector(`[data-required-field="${missingFields[0]}"] .inline-input:not([readonly])`)?.focus();
    return false;
  }

  function clearInlineFieldError(target, field) {
    if (!target || !["title", "requester"].includes(field) || !String(target.value || "").trim()) return;
    const fieldEl = target.closest(`[data-required-field="${field}"]`);
    fieldEl?.classList.remove("has-error");
    target.setAttribute("aria-invalid", "false");
  }

  function fillGoalFromTitleIfBlank(node) {
    const title = String(node?.title || "").trim();
    if (!node || !title || String(node.goal || "").trim()) return false;
    node.goal = title;
    return true;
  }

  function syncGoalFromTitleIfBlankOrSynced(node, nextTitle, previousTitle) {
    const title = String(nextTitle || "").trim();
    const goal = String(node?.goal || "");
    const previous = String(previousTitle || "").trim();
    if (!node || !title || (goal.trim() && goal.trim() !== previous)) return false;
    node.goal = title;
    return true;
  }

  function finalizeInlineEdit(id = selectedNodeId) {
    const node = nodeById(id);
    if (!node) return true;
    if (!validateInlineRequiredFields(node)) return false;
    if (fillGoalFromTitleIfBlank(node)) {
      const goalInput = $(`[data-node-id="${node.id}"] [data-inline-field="goal"]`, nodesLayer);
      if (goalInput) {
        goalInput.value = node.goal;
        goalInput.style.height = "auto";
        goalInput.style.height = `${goalInput.scrollHeight}px`;
      }
    }
    rememberPerson(node.requester);
    trackRequesterPublication(node);
    saveState();
    return true;
  }

  function selectNode(id) {
    if (selectedNodeId && selectedNodeId !== id && !pinnedInlineNodeIds.has(selectedNodeId) && !finalizeInlineEdit(selectedNodeId)) return false;
    selectedNodeId = id;
    multiSelectedNodeIds.clear();
    multiSelectedNodeIds.add(id);
    renderNodes();
    renderEdges();
    return true;
  }

  function canvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - state.view.x) / state.view.zoom,
      y: (clientY - rect.top - state.view.y) / state.view.zoom,
    };
  }

  function nodePositionNearPoint(point) {
    return {
      x: point.x + 24,
      y: point.y - NODE_CARD_TOP - NODE_CARD_HEIGHT / 2,
    };
  }

  function isPointerOutsideViewport(event) {
    return event.clientX < 0 || event.clientY < 0 || event.clientX > window.innerWidth || event.clientY > window.innerHeight;
  }

  function stopCanvasPan() {
    if (!panSession) return;
    saveState();
    panSession = null;
    canvas.classList.remove("panning");
  }

  function openNodeModal(position) {
    pendingNodePosition = position || visibleCenterPoint();
    pendingImageData = [];
    renderPeopleSuggestions();
    $("#nodeForm").reset();
    $("#newImagePreview").hidden = true;
    $("#newImagePreview").removeAttribute("src");
    $("#newNodeType").value = "task";
    $("#newNodeStatus").value = "todo";
    $("#newNodeRequester").value = recentPerson();
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
    const images = normalizeImageList(data.images, data.image);
    const node = {
      id,
      x: Math.round(position.x),
      y: Math.round(position.y),
      type: data.type || "task",
      status: data.status || "todo",
      priority: data.priority === undefined ? (connectFrom ? effectivePriority(connectFrom) : 0) : normalizePriority(data.priority),
      title: data.title || "未命名任务",
      requester: String(data.requester || "").trim(),
      goal: data.goal || "",
      note: data.note || "等待开始",
      image: images[0] || "",
      images,
      date: isoDate(new Date()),
      completedAt: normalizeCompletionDate(data.completedAt) || ((data.status || "todo") === "done" ? isoDate(new Date()) : ""),
    };
    state.nodes.push(node);
    rememberPerson(node.requester);
    if (connectFrom && canConnect(nodeById(connectFrom), node)) {
      state.edges.push({ id: `e${Date.now().toString(36)}`, from: connectFrom, to: id });
    }
    trackRequesterPublication(node);
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
      image: nodeImages(source)[0] || "",
      images: [...nodeImages(source)],
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

  async function addImagesToNode(node, files) {
    const imageFiles = Array.from(files || []).filter((file) => file?.type?.startsWith("image/"));
    if (!node || !imageFiles.length) return false;
    const previousImages = nodeImages(node);
    const availableCount = MAX_NODE_IMAGES - previousImages.length;
    if (availableCount <= 0) {
      showToast(`每个节点最多添加 ${MAX_NODE_IMAGES} 张图片`);
      return false;
    }
    const acceptedFiles = imageFiles.slice(0, availableCount);
    try {
      const addedImages = await Promise.all(acceptedFiles.map((file) => compressImage(file)));
      pushUndoSnapshot();
      setNodeImages(node, [...previousImages, ...addedImages]);
      if (!saveState()) {
        setNodeImages(node, previousImages);
        return false;
      }
      renderAll();
      const limitNotice = imageFiles.length > acceptedFiles.length ? `，单节点最多 ${MAX_NODE_IMAGES} 张` : "";
      showToast(`已添加 ${addedImages.length} 张图片${limitNotice}`);
      return true;
    } catch (error) {
      showToast(error.message);
      return false;
    }
  }

  function addImageToNode(node, file) {
    return addImagesToNode(node, file ? [file] : []);
  }

  function pastedImageFiles(clipboardData) {
    const itemFiles = Array.from(clipboardData?.items || [])
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean);
    if (itemFiles.length) return itemFiles;
    return Array.from(clipboardData?.files || [])
      .filter((file) => file.type.startsWith("image/"));
  }

  function nodeForImagePasteTarget(target) {
    if (target?.closest?.(".modal-backdrop, .image-lightbox")) return null;
    const inlineNodeEl = target?.closest?.(".task-node.inline-editing");
    if (inlineNodeEl) return nodeById(inlineNodeEl.dataset.nodeId);
    if (editorContent.contains(target) && selectedNodeId) return nodeById(selectedNodeId);
    const outsideTypingTarget = target?.matches?.("input, textarea, select, [contenteditable='true']")
      && !target.closest?.(".inline-node-editor")
      && !editorContent.contains(target);
    if (outsideTypingTarget) return null;
    const selectedInlineNode = selectedNodeId ? $(`.task-node.inline-editing[data-node-id="${selectedNodeId}"]`, nodesLayer) : null;
    if (selectedInlineNode) return nodeById(selectedNodeId);
    const visiblePinnedIds = [...pinnedInlineNodeIds].filter((id) => $(`.task-node.inline-editing[data-node-id="${id}"]`, nodesLayer));
    return visiblePinnedIds.length === 1 ? nodeById(visiblePinnedIds[0]) : null;
  }

  function deleteNodes(ids) {
    const nodeIds = new Set(ids.filter((id) => nodeById(id)));
    if (!nodeIds.size) return;
    pushUndoSnapshot();
    state.nodes = state.nodes.filter((node) => !nodeIds.has(node.id));
    state.edges = state.edges.filter((edge) => !nodeIds.has(edge.from) && !nodeIds.has(edge.to));
    nodeIds.forEach((id) => {
      pinnedInlineNodeIds.delete(id);
      collapsedBranchNodes.delete(id);
      autoCollapsedBranchNodes.delete(id);
      expandedGoalNodes.delete(id);
      multiSelectedNodeIds.delete(id);
    });
    persistCollapsedBranches();
    if (nodeIds.has(selectedNodeId)) selectedNodeId = null;
    saveState();
    renderAll();
    showToast(nodeIds.size > 1 ? `已删除 ${nodeIds.size} 个节点` : "节点已删除");
  }

  function deleteNode(id) {
    deleteNodes([id]);
  }

  function deleteSelectedNodes() {
    if (selectedNodeId) deleteNodes([selectedNodeId]);
    else deleteNodes([...multiSelectedNodeIds]);
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
    const compact = (value, limit = 42) => {
      const text = String(value || "").replace(/\s+/g, " ").trim();
      return text.length > limit ? `${text.slice(0, limit)}…` : text;
    };
    const reportSort = (a, b) => {
      const requesterDiff = effectiveRequester(a[0].id).localeCompare(effectiveRequester(b[0].id), "zh-CN");
      if (requesterDiff) return requesterDiff;
      const priorityDiff = effectivePriority(b[0].id) - effectivePriority(a[0].id);
      if (priorityDiff) return priorityDiff;
      return chainTaskName(a[0].id).localeCompare(chainTaskName(b[0].id), "zh-CN");
    };
    const today = isoDate(new Date());
    const periodStart = (() => {
      if (period === "day") return today;
      if (period === "month") return `${today.slice(0, 7)}-01`;
      const now = new Date();
      const day = now.getDay() || 7;
      const start = new Date(now);
      start.setDate(now.getDate() - day + 1);
      return isoDate(start);
    })();
    const completedInPeriod = (node) => node.status === "done" && node.completedAt && node.completedAt >= periodStart && node.completedAt <= today;
    const componentLines = (component, predicate, { markCompleted = false } = {}) => {
      const relevant = component.filter(predicate).sort((a, b) => a.x - b.x || a.y - b.y);
      if (!relevant.length) return [];
      const start = chainStart(component[0].id) || component[0];
      const requester = effectiveRequester(start.id) || "未填写姓名";
      const componentIds = new Set(component.map((node) => node.id));
      const childrenById = new Map(component.map((node) => [node.id, []]));
      state.edges.forEach((edge) => {
        if (!componentIds.has(edge.from) || !componentIds.has(edge.to)) return;
        const child = nodeById(edge.to);
        if (child) childrenById.get(edge.from)?.push(child);
      });
      childrenById.forEach((children) => children.sort((a, b) => a.y - b.y || a.x - b.x));
      const startBlocker = relevant.includes(start) && start.status === "blocked"
        ? `｜卡点：${compact(start.note) || compact(start.title) || "未填写"}`
        : "";
      const completionSuffix = markCompleted ? "｜已完成" : "";
      const lines = [`${requester}｜${chainTaskName(start.id)}${startBlocker}${completionSuffix}`];
      const relevantIds = new Set(relevant.map((node) => node.id));
      const descendantMemo = new Map();
      const hasRelevantDescendant = (nodeId, visiting = new Set()) => {
        if (descendantMemo.has(nodeId)) return descendantMemo.get(nodeId);
        if (visiting.has(nodeId)) return false;
        const nextVisiting = new Set(visiting).add(nodeId);
        const result = relevantIds.has(nodeId) || (childrenById.get(nodeId) || []).some((child) => hasRelevantDescendant(child.id, nextVisiting));
        descendantMemo.set(nodeId, result);
        return result;
      };
      const rendered = new Set();
      const appendChildren = (parentId, depth, visiting = new Set()) => {
        if (visiting.has(parentId)) return;
        const nextVisiting = new Set(visiting).add(parentId);
        (childrenById.get(parentId) || []).forEach((child) => {
          if (!hasRelevantDescendant(child.id) || rendered.has(child.id)) return;
          const showChild = relevantIds.has(child.id);
          if (showChild) {
            const label = child.status === "blocked"
              ? `卡点：${compact(child.note) || compact(child.title) || "未填写"}`
              : compact(child.note) || child.title;
            lines.push(`${"  ".repeat(depth)}- ${label}${markCompleted ? "｜已完成" : ""}`);
            rendered.add(child.id);
          }
          appendChildren(child.id, showChild ? depth + 1 : depth, nextVisiting);
        });
      };
      if (relevantIds.has(start.id)) rendered.add(start.id);
      appendChildren(start.id, 1);
      relevant.forEach((node) => {
        if (rendered.has(node.id)) return;
        const label = node.status === "blocked"
          ? `卡点：${compact(node.note) || compact(node.title) || "未填写"}`
          : compact(node.note) || node.title;
        lines.push(`  - ${label}${markCompleted ? "｜已完成" : ""}`);
        rendered.add(node.id);
      });
      return lines;
    };
    const components = chainComponents().sort(reportSort);
    const completed = components.flatMap((component) => {
      const start = chainStart(component[0]?.id) || component[0];
      const completedAsChain = component.every((node) => node.status === "done") && completedInPeriod(start);
      return completedAsChain
        ? componentLines(component, () => true, { markCompleted: component.length > 1 })
        : componentLines(component, completedInPeriod);
    });
    const unfinished = components.flatMap((component) => componentLines(component, (node) => node.status !== "done"));
    const completedTitle = period === "day" ? "一、今天完成" : "一、本期完成";

    return [
      `${reportTitle(period)}｜${dateRange(period)}`,
      "",
      completedTitle,
      ...(completed.length ? completed : ["暂无"]),
      "",
      "二、未完成及卡点",
      ...(unfinished.length ? unfinished : ["暂无"]),
    ].join("\n");
  }

  function updateReport() {
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

  function visibleCanvasSnapshotBounds() {
    const nodes = $$("#nodesLayer .task-node");
    if (!nodes.length) return null;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    nodes.forEach((node) => {
      const x = Number.parseFloat(node.style.left) || node.offsetLeft || 0;
      const y = Number.parseFloat(node.style.top) || node.offsetTop || 0;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + (node.offsetWidth || NODE_WIDTH));
      bottom = Math.max(bottom, y + (node.offsetHeight || NODE_CARD_TOP + NODE_CARD_HEIGHT));
    });
    try {
      const edgeBox = edgePaths.getBBox();
      if (edgeBox.width || edgeBox.height) {
        left = Math.min(left, edgeBox.x);
        top = Math.min(top, edgeBox.y);
        right = Math.max(right, edgeBox.x + edgeBox.width);
        bottom = Math.max(bottom, edgeBox.y + edgeBox.height);
      }
    } catch {
      // Empty SVG groups can fail getBBox; node bounds are enough in that case.
    }
    const width = world.offsetWidth || 4000;
    const height = world.offsetHeight || 2400;
    const paddedLeft = Math.max(0, Math.floor(left - SNAPSHOT_PADDING));
    const paddedTop = Math.max(0, Math.floor(top - SNAPSHOT_PADDING));
    const paddedRight = Math.min(width, Math.ceil(right + SNAPSHOT_PADDING));
    const paddedBottom = Math.min(height, Math.ceil(bottom + SNAPSHOT_PADDING));
    return {
      left: paddedLeft,
      top: paddedTop,
      width: Math.max(1, paddedRight - paddedLeft),
      height: Math.max(1, paddedBottom - paddedTop),
    };
  }

  function snapshotScaleFor(width, height) {
    const dimensionScale = SNAPSHOT_MAX_DIMENSION / Math.max(width, height);
    const pixelScale = Math.sqrt(SNAPSHOT_MAX_PIXELS / Math.max(1, width * height));
    return Math.max(1, Math.min(SNAPSHOT_TARGET_SCALE, dimensionScale, pixelScale));
  }

  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("无法生成快照图片"));
      }, "image/png", 1);
    });
  }

  function loadSnapshotImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("快照图片渲染失败"));
      image.src = url;
    });
  }

  function snapshotPalette() {
    const styles = getComputedStyle(document.documentElement);
    const color = (name) => styles.getPropertyValue(name).trim();
    return {
      bg: color("--bg"),
      surface: color("--surface-solid"),
      surfaceSoft: color("--surface-soft"),
      line: color("--line"),
      lineStrong: color("--line-strong"),
      ink: color("--ink"),
      muted: color("--muted"),
      grid: color("--grid"),
      accent: color("--accent"),
      accentSoft: color("--accent-soft"),
      todo: color("--todo"),
      todoSoft: color("--todo-soft"),
      doing: color("--doing"),
      doingSoft: color("--doing-soft"),
      blocked: color("--blocked"),
      blockedSoft: color("--blocked-soft"),
      done: color("--done"),
      doneSoft: color("--done-soft"),
      doneCard: color("--done-card"),
      doneCardStrong: color("--done-card-strong"),
      doneInk: color("--done-ink"),
      doneMuted: color("--done-muted"),
      font: styles.fontFamily,
    };
  }

  function snapshotStatusColors(status, palette) {
    const map = {
      todo: { color: palette.todo, soft: palette.todoSoft },
      doing: { color: palette.doing, soft: palette.doingSoft },
      blocked: { color: palette.blocked, soft: palette.blockedSoft },
      done: { color: palette.done, soft: palette.doneSoft },
    };
    return map[status] || map.todo;
  }

  function snapshotWrapText(value, maxChars, maxLines) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return [];
    const chars = Array.from(text);
    const lines = [];
    let index = 0;
    while (index < chars.length && lines.length < maxLines) {
      let line = chars.slice(index, index + maxChars).join("");
      index += maxChars;
      if (index < chars.length && lines.length === maxLines - 1) line = `${line.slice(0, Math.max(1, line.length - 1))}…`;
      lines.push(line);
    }
    return lines;
  }

  function snapshotText(lines, x, y, options = {}) {
    const values = Array.isArray(lines) ? lines : [lines];
    const size = options.size || 12;
    const lineHeight = options.lineHeight || Math.round(size * 1.45);
    const weight = options.weight || 500;
    const color = options.color || "currentColor";
    return `<text x="${x}" y="${y}" fill="${escapeHtml(color)}" font-size="${size}" font-weight="${weight}" font-family="inherit">${values.map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${escapeHtml(line)}</tspan>`).join("")}</text>`;
  }

  function snapshotEdgeGeometry(fromNode, toNode, bounds) {
    const x1 = fromNode.x + NODE_WIDTH - bounds.left;
    const y1 = fromNode.y + NODE_CARD_TOP + cardHeightFor(fromNode) / 2 - bounds.top;
    const x2 = toNode.x - bounds.left;
    const y2 = toNode.y + NODE_CARD_TOP + cardHeightFor(toNode) / 2 - bounds.top;
    const gap = x2 - x1;
    const distance = gap >= 0 ? Math.max(24, Math.min(160, gap * 0.45)) : Math.max(100, Math.abs(gap) * 0.55);
    return {
      x1,
      y1,
      x2,
      y2,
      path: `M ${x1} ${y1} C ${x1 + distance} ${y1}, ${x2 - distance} ${y2}, ${x2} ${y2}`,
    };
  }

  function snapshotImageMarkup(node, x, y, palette) {
    const images = nodeImages(node).filter((image) => image.startsWith("data:"));
    if (!images.length) return "";
    const size = 48;
    const imageX = x + NODE_WIDTH - size - 15;
    const imageY = y + 60;
    return `<clipPath id="clip-${escapeHtml(node.id)}"><rect x="${imageX}" y="${imageY}" width="${size}" height="${size}" rx="8"></rect></clipPath>
      <rect x="${imageX}" y="${imageY}" width="${size}" height="${size}" rx="8" fill="${escapeHtml(palette.surfaceSoft)}" stroke="${escapeHtml(palette.lineStrong)}"></rect>
      <image href="${escapeHtml(images[0])}" x="${imageX}" y="${imageY}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-${escapeHtml(node.id)})"></image>
      ${images.length > 1 ? `<rect x="${imageX + size - 25}" y="${imageY + size - 18}" width="23" height="16" rx="5" fill="rgba(25,30,27,.72)"></rect>${snapshotText(`+${images.length - 1}`, imageX + size - 20, imageY + size - 6, { size: 9, weight: 800, color: "#fff" })}` : ""}`;
  }

  function snapshotNodeMarkup(node, bounds, palette) {
    const statusColors = snapshotStatusColors(node.status, palette);
    const nodeType = derivedType(node.id);
    const isChild = nodeType !== "start";
    const x = node.x - bounds.left;
    const y = node.y - bounds.top;
    const cardY = y + NODE_CARD_TOP;
    const height = Math.max(NODE_CARD_HEIGHT, cardHeightFor(node));
    const isDone = node.status === "done";
    const cardFill = isDone ? palette.doneCard : palette.surface;
    const cardFillBottom = isDone ? palette.doneCardStrong : palette.surface;
    const textColor = isDone ? palette.doneInk : palette.ink;
    const mutedColor = isDone ? palette.doneMuted : palette.muted;
    const title = isChild ? (node.note || node.title || "未填写进展") : (node.title || "未命名任务");
    const subtitle = isChild ? `任务 · ${chainTaskName(node.id)}` : `目标 · ${node.goal || "未填写任务目标"}`;
    const requester = effectiveRequester(node.id) || "未填写来源人";
    const priority = String(effectivePriority(node.id));
    const date = node.status === "done" && node.completedAt ? node.completedAt : (node.date || isoDate(new Date()));
    const titleMaxChars = nodeImages(node).length ? 13 : 18;
    const titleLines = snapshotWrapText(title, titleMaxChars, 2);
    const subtitleLines = snapshotWrapText(subtitle, nodeImages(node).length ? 20 : 28, 2);
    return `<g>
      <rect x="${x + 9}" y="${y}" width="222" height="24" rx="8" fill="${escapeHtml(statusColors.soft)}" stroke="${escapeHtml(statusColors.color)}" stroke-opacity=".22"></rect>
      ${snapshotText(`链目标 · ${snapshotWrapText(chainGoal(node.id), 20, 1)[0] || "未填写任务链目标"}`, x + 22, y + 16, { size: 9, weight: 700, color: statusColors.color })}
      <rect x="${x}" y="${cardY}" width="${NODE_WIDTH}" height="${height}" rx="14" fill="${escapeHtml(cardFill)}" stroke="${escapeHtml(statusColors.color)}" stroke-opacity="${isDone ? ".68" : ".28"}"></rect>
      <rect x="${x}" y="${cardY}" width="${NODE_WIDTH}" height="${height}" rx="14" fill="url(#node-soft-${escapeHtml(node.id)})"></rect>
      <rect x="${x}" y="${cardY + 12}" width="5" height="${Math.max(28, height - 24)}" rx="3" fill="${escapeHtml(statusColors.color)}"></rect>
      <defs><linearGradient id="node-soft-${escapeHtml(node.id)}" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="${escapeHtml(isDone ? palette.doneCard : statusColors.soft)}" stop-opacity="${isDone ? ".18" : ".58"}"></stop><stop offset="48%" stop-color="${escapeHtml(cardFillBottom)}" stop-opacity=".98"></stop></linearGradient></defs>
      <rect x="${x + 17}" y="${cardY + 16}" width="22" height="22" rx="7" fill="${escapeHtml(isDone ? "rgba(255,255,255,.10)" : statusColors.soft)}" stroke="${escapeHtml(statusColors.color)}" stroke-opacity=".2"></rect>
      ${snapshotText(requester, x + 48, cardY + 31, { size: 10, weight: 780, color: textColor })}
      <rect x="${x + NODE_WIDTH - 52}" y="${cardY + 13}" width="24" height="24" rx="7" fill="${escapeHtml(isDone ? "rgba(255,255,255,.10)" : palette.surfaceSoft)}" stroke="${escapeHtml(palette.line)}"></rect>
      ${snapshotText(priority, x + NODE_WIDTH - 44, cardY + 29, { size: 10, weight: 850, color: textColor })}
      ${snapshotImageMarkup(node, x, cardY, palette)}
      ${snapshotText(titleLines, x + 17, cardY + 70, { size: 14, lineHeight: 19, weight: 820, color: textColor })}
      ${snapshotText(subtitleLines, x + 17, cardY + 118, { size: 10, lineHeight: 15, weight: 600, color: mutedColor })}
      <rect x="${x}" y="${cardY + height - 30}" width="${NODE_WIDTH}" height="30" rx="0" fill="${escapeHtml(isDone ? "rgba(19,24,21,.24)" : statusColors.soft)}" opacity=".78"></rect>
      <rect x="${x + 14}" y="${cardY + height - 22}" width="70" height="18" rx="9" fill="${escapeHtml(isDone ? "rgba(255,255,255,.10)" : palette.surface)}" stroke="${escapeHtml(statusColors.color)}" stroke-opacity=".22"></rect>
      <circle cx="${x + 25}" cy="${cardY + height - 13}" r="3.2" fill="${escapeHtml(statusColors.color)}"></circle>
      ${snapshotText(statusMeta[node.status]?.label || "开启", x + 34, cardY + height - 9, { size: 9, weight: 760, color: isDone ? palette.doneInk : statusColors.color })}
      ${snapshotText(date, x + NODE_WIDTH - 67, cardY + height - 9, { size: 9, weight: 760, color: mutedColor })}
    </g>`;
  }

  function snapshotSvgMarkup(bounds) {
    const palette = snapshotPalette();
    const visible = displayedNodeIds();
    const visibleNodes = state.nodes.filter((node) => visible.has(node.id));
    const visibleEdges = state.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to));
    const gridX = ((-bounds.left % 24) + 24) % 24;
    const gridY = ((-bounds.top % 24) + 24) % 24;
    const edgeMarkup = visibleEdges.map((edge, index) => {
      const from = nodeById(edge.from);
      const to = nodeById(edge.to);
      if (!from || !to) return "";
      const geometry = snapshotEdgeGeometry(from, to, bounds);
      const fromColor = snapshotStatusColors(from.status, palette).color;
      const toColor = snapshotStatusColors(to.status, palette).color;
      return `<linearGradient id="snap-edge-${index}" gradientUnits="userSpaceOnUse" x1="${geometry.x1}" y1="${geometry.y1}" x2="${geometry.x2}" y2="${geometry.y2}"><stop offset="0%" stop-color="${escapeHtml(fromColor)}"></stop><stop offset="100%" stop-color="${escapeHtml(toColor)}"></stop></linearGradient>
        <marker id="snap-arrow-${index}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 8 4 0 8Z" fill="${escapeHtml(toColor)}"></path></marker>
        <path d="${geometry.path}" fill="none" stroke="${escapeHtml(palette.surface)}" stroke-width="7" opacity=".92" stroke-linecap="round"></path>
        <path d="${geometry.path}" fill="none" stroke="url(#snap-edge-${index})" stroke-width="3.4" opacity=".96" stroke-linecap="round" marker-end="url(#snap-arrow-${index})"></path>`;
    }).join("");
    const nodeMarkup = visibleNodes.map((node) => snapshotNodeMarkup(node, bounds, palette)).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}">
      <defs>
        <style><![CDATA[text { font-family: ${palette.font}; dominant-baseline: alphabetic; }]]></style>
        <pattern id="snapshot-grid" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="translate(${gridX} ${gridY})"><circle cx="1.2" cy="1.2" r="1.2" fill="${escapeHtml(palette.grid)}"></circle></pattern>
        <radialGradient id="snapshot-glow" cx="22%" cy="10%" r="42%"><stop offset="0%" stop-color="${escapeHtml(palette.accentSoft)}" stop-opacity=".52"></stop><stop offset="72%" stop-color="${escapeHtml(palette.bg)}" stop-opacity="0"></stop></radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="${escapeHtml(palette.bg)}"></rect>
      <rect width="100%" height="100%" fill="url(#snapshot-glow)"></rect>
      <rect width="100%" height="100%" fill="url(#snapshot-grid)"></rect>
      ${edgeMarkup}
      ${nodeMarkup}
    </svg>`;
  }

  async function renderCanvasSnapshot() {
    const bounds = visibleCanvasSnapshotBounds();
    if (!bounds) throw new Error("当前画布没有可保存的任务节点");
    const svg = snapshotSvgMarkup(bounds);
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const image = await loadSnapshotImage(svgUrl);
      const scale = snapshotScaleFor(bounds.width, bounds.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bounds.width * scale);
      canvas.height = Math.round(bounds.height * scale);
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.scale(scale, scale);
      context.drawImage(image, 0, 0, bounds.width, bounds.height);
      return {
        blob: await canvasToPngBlob(canvas),
        width: canvas.width,
        height: canvas.height,
      };
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  async function saveCanvasSnapshot() {
    const button = $("#snapshotButton");
    button.disabled = true;
    showToast("正在生成高清快照...");
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const { blob, width, height } = await renderCanvasSnapshot();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Flowlog_画布快照_${isoDate(new Date())}.png`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`高清快照已保存：${width}×${height}`);
    } catch (error) {
      console.error("保存画布快照失败", error);
      showToast(error.message || "快照保存失败");
    } finally {
      button.disabled = false;
    }
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
    $("meta[name='theme-color']").content = theme === "dark" ? "#171b18" : "#eceee8";
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function renderImageLightbox() {
    if (!lightboxImages.length) return;
    const image = $("#imageLightboxImage");
    image.src = lightboxImages[lightboxIndex];
    image.alt = `图片 ${lightboxIndex + 1}`;
    $("#imageLightboxCount").textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
    $("#imageLightboxPrevious").hidden = lightboxImages.length < 2;
    $("#imageLightboxNext").hidden = lightboxImages.length < 2;
  }

  function openImageLightbox(images, startIndex = 0) {
    lightboxImages = normalizeImageList(images);
    if (!lightboxImages.length) return;
    lightboxIndex = Math.min(lightboxImages.length - 1, Math.max(0, Number(startIndex) || 0));
    renderImageLightbox();
    $("#imageLightbox").hidden = false;
    $("#imageLightboxClose").focus();
  }

  function closeImageLightbox() {
    $("#imageLightbox").hidden = true;
    $("#imageLightboxImage").removeAttribute("src");
    lightboxImages = [];
    lightboxIndex = 0;
  }

  function moveImageLightbox(direction) {
    if (lightboxImages.length < 2) return;
    lightboxIndex = (lightboxIndex + direction + lightboxImages.length) % lightboxImages.length;
    renderImageLightbox();
  }

  canvas.addEventListener("dblclick", (event) => {
    if (event.target.closest(".task-node") || event.target.closest(".zoom-controls") || event.target.closest(".status-legend")) return;
    const point = canvasPoint(event.clientX, event.clientY);
    createNode(
      { title: "新任务", type: "start", status: "todo", priority: 0, goal: "", note: "" },
      nodePositionNearPoint(point),
    );
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
    if (handle && event.button === 0) {
      event.stopPropagation();
      const nodeEl = handle.closest(".task-node");
      const from = nodeById(nodeEl.dataset.nodeId);
      if (!from) {
        showToast("该节点不能再创建后续连接");
        return;
      }
      connectionSession = {
        fromId: from.id,
        point: canvasPoint(event.clientX, event.clientY),
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };
      draftEdge.hidden = true;
      draftEdge.setAttribute("d", "");
      return;
    }

    const nodeEl = event.target.closest(".task-node");
    const dragSurface = event.target.closest(".node-card");
    const dragControl = event.target.closest("button, input, select, textarea, label, .status-select-shell");
    const canDragSurface = nodeEl && dragSurface && (!nodeEl.classList.contains("inline-editing") || event.target.closest(".node-header"));
    if (canDragSurface && !dragControl && event.button === 0) {
      event.preventDefault();
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
      const isChainDrag = !event.altKey && (event.ctrlKey || event.metaKey);
      const dragIds = isChainDrag
        ? connectedNodes(node.id).map((chainNode) => chainNode.id)
        : (!event.altKey && multiSelectedNodeIds.has(node.id) ? [...multiSelectedNodeIds] : [node.id]);
      if (isChainDrag) {
        multiSelectedNodeIds.clear();
        updateSelectionVisuals();
        if (dragIds.length > 1) showToast(`按住 Ctrl，正在移动整条任务链（${dragIds.length} 个节点）`);
      } else if (!multiSelectedNodeIds.has(node.id)) {
        multiSelectedNodeIds.clear();
        multiSelectedNodeIds.add(node.id);
        updateSelectionVisuals();
      }
      nodeDragSession = { ids: dragIds, primaryId: node.id, isChainDrag, startX: point.x, startY: point.y, origins: dragIds.map((id) => ({ id, x: nodeById(id).x, y: nodeById(id).y })), moved: false, historySnapshot: JSON.stringify(state) };
      return;
    }

    if (nodeEl && event.target.closest(".node-chain-label, .node-header-actions, .inline-node-editor, .status-quick-select")) return;

    if (nodeEl) return;

    if (event.target.closest(".zoom-controls") || event.target.closest(".status-legend")) return;
    const selectedNodeIsPinned = Boolean(selectedNodeId && pinnedInlineNodeIds.has(selectedNodeId));
    if (selectedNodeId && !selectedNodeIsPinned && !finalizeInlineEdit()) {
      event.preventDefault();
      return;
    }
    expandedGoalNodes.clear();
    if (event.shiftKey && event.button === 0) {
      const rect = canvas.getBoundingClientRect();
      selectionSession = { startX: event.clientX, startY: event.clientY, rect };
      selectionBox.hidden = false;
      selectionBox.style.left = `${event.clientX - rect.left}px`;
      selectionBox.style.top = `${event.clientY - rect.top}px`;
      selectionBox.style.width = "0px";
      selectionBox.style.height = "0px";
      if (!selectedNodeIsPinned) selectedNodeId = null;
      multiSelectedNodeIds.clear();
      renderNodes();
      canvas.classList.add("selecting");
      return;
    }
    if (!selectedNodeIsPinned) {
      selectedNodeId = null;
      clearMultiSelection();
      renderNodes();
      renderEdges();
    }
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
      if (!connectionSession.moved && Math.hypot(event.clientX - connectionSession.startX, event.clientY - connectionSession.startY) >= 6) {
        connectionSession.moved = true;
        draftEdge.hidden = false;
      }
      if (connectionSession.moved) draftEdge.setAttribute("d", draftPath(nodeById(connectionSession.fromId), connectionSession.point));
      return;
    }
    if (nodeDragSession) {
      const point = canvasPoint(event.clientX, event.clientY);
      if (!nodeDragSession.moved) pushUndoSnapshot(nodeDragSession.historySnapshot);
      const deltaX = point.x - nodeDragSession.startX;
      const deltaY = point.y - nodeDragSession.startY;
      nodeDragSession.origins.forEach((origin) => {
        const node = nodeById(origin.id);
        node.x = origin.x + deltaX;
        node.y = origin.y + deltaY;
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
      if (isPointerOutsideViewport(event)) {
        stopCanvasPan();
        return;
      }
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
      const session = connectionSession;
      const fromId = session.fromId;
      const releasePoint = canvasPoint(event.clientX, event.clientY);
      const targetHandle = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".node-handle.input");
      draftEdge.hidden = true;
      draftEdge.setAttribute("d", "");
      connectionSession = null;
      if (!session.moved) {
        toggleBranchCollapse(fromId);
        return;
      }
      collapsedBranchNodes.delete(fromId);
      autoCollapsedBranchNodes.delete(fromId);
      persistCollapsedBranches();
      if (targetHandle) {
        addEdge(fromId, targetHandle.closest(".task-node").dataset.nodeId);
      } else {
        const sourceType = derivedType(fromId);
        const inheritedStatus = sourceType === "start" || sourceType === "task" ? "doing" : "todo";
        createNode(
          { title: chainTaskName(fromId), requester: effectiveRequester(fromId), priority: effectivePriority(fromId), type: "task", status: inheritedStatus, goal: "", note: "等待补充任务信息" },
          nodePositionNearPoint(releasePoint),
          fromId,
        );
        showToast("已自动创建后续节点");
      }
    }
    if (nodeDragSession) {
      const session = nodeDragSession;
      saveState();
      if (session.isChainDrag) {
        multiSelectedNodeIds.clear();
        if (selectedNodeId && session.ids.includes(selectedNodeId) && !pinnedInlineNodeIds.has(selectedNodeId)) selectedNodeId = null;
        renderNodes();
        renderEdges();
      }
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
      stopCanvasPan();
    }
  });

  window.addEventListener("pointercancel", () => {
    if (edgeCancelSession) {
      clearTimeout(edgeCancelSession.timer);
      edgeCancelSession.visualPath?.classList.remove("canceling");
      edgeCancelSession = null;
    }
    stopCanvasPan();
  });

  window.addEventListener("pointerout", (event) => {
    if (panSession && !event.relatedTarget) stopCanvasPan();
  });

  window.addEventListener("blur", () => {
    stopCanvasPan();
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
    const createTemplate = event.target.closest("[data-create-template]");
    if (createTemplate) {
      event.stopPropagation();
      if (!finalizeInlineEdit(createTemplate.dataset.createTemplate)) return;
      createStartTemplate(createTemplate.dataset.createTemplate);
      return;
    }
    const inlinePinToggle = event.target.closest("[data-toggle-inline-pin]");
    if (inlinePinToggle) {
      event.stopPropagation();
      toggleInlinePin(inlinePinToggle.dataset.toggleInlinePin);
      return;
    }
    const deleteInline = event.target.closest("[data-delete-inline]");
    if (deleteInline) {
      event.stopPropagation();
      deleteNode(deleteInline.dataset.deleteInline);
      return;
    }
    const menu = event.target.closest("[data-node-menu]");
    if (menu) {
      event.stopPropagation();
      selectNode(menu.dataset.nodeMenu);
    }
  });

  templateList.addEventListener("click", (event) => {
    const useTemplate = event.target.closest("[data-use-template]");
    if (useTemplate) {
      instantiateTemplate(useTemplate.dataset.useTemplate);
      return;
    }
    const removeTemplate = event.target.closest("[data-delete-template]");
    if (removeTemplate) deleteTemplate(removeTemplate.dataset.deleteTemplate);
  });

  peopleList?.addEventListener("click", (event) => {
    const deletePerson = event.target.closest("[data-delete-person]");
    if (!deletePerson) return;
    removeRememberedPerson(deletePerson.dataset.deletePerson);
  });

  document.addEventListener("focusin", (event) => {
    if (!isPersonInput(event.target)) return;
    personSuggestionIndex = -1;
    showPersonSuggestions(event.target);
  });

  document.addEventListener("focusout", (event) => {
    if (!isPersonInput(event.target)) return;
    setTimeout(() => {
      const box = personSuggestionBox();
      if (document.activeElement === activePersonInput || box.contains(document.activeElement)) return;
      hidePersonSuggestions();
    }, 120);
  });

  document.addEventListener("input", (event) => {
    if (!isPersonInput(event.target)) return;
    personSuggestionIndex = -1;
    showPersonSuggestions(event.target);
  });

  document.addEventListener("change", (event) => {
    if (isPersonInput(event.target)) {
      rememberPerson(event.target.value);
      trackRequesterInputPublication(event.target);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!isPersonInput(event.target)) return;
    const box = personSuggestionBox();
    if (event.key === "Escape") {
      hidePersonSuggestions();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
    if (box.hidden) showPersonSuggestions(event.target);
    const options = $$("[data-person-suggestion]", box);
    if (!options.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      personSuggestionIndex = (personSuggestionIndex + 1 + options.length) % options.length;
      updatePersonSuggestionActive();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      personSuggestionIndex = (personSuggestionIndex - 1 + options.length) % options.length;
      updatePersonSuggestionActive();
      return;
    }
    if (event.key === "Enter" && personSuggestionIndex >= 0) {
      event.preventDefault();
      choosePersonSuggestion(options[personSuggestionIndex].dataset.personSuggestion);
    }
  });

  document.addEventListener("pointerdown", (event) => {
    const option = event.target.closest?.("[data-person-suggestion]");
    if (option) {
      event.preventDefault();
      event.stopImmediatePropagation();
      choosePersonSuggestion(option.dataset.personSuggestion);
      return;
    }
    if (activePersonInput && !event.target.closest?.(".person-suggestion-box") && event.target !== activePersonInput) hidePersonSuggestions();
  });

  window.addEventListener("resize", () => {
    if (activePersonInput) showPersonSuggestions(activePersonInput);
  });

  nodesLayer.addEventListener("focusin", (event) => {
    if (event.target.dataset.inlineField) fieldUndoSnapshot = JSON.stringify(state);
  });

  nodesLayer.addEventListener("input", (event) => {
    const field = event.target.dataset.inlineField;
    const nodeEl = event.target.closest(".task-node");
    const node = nodeById(nodeEl?.dataset.nodeId);
    if (!field || !node) return;
    if (field === "status") return;
    clearInlineFieldError(event.target, field);
    if (fieldUndoSnapshot) {
      pushUndoSnapshot(fieldUndoSnapshot);
      fieldUndoSnapshot = null;
    }
    const previousTitle = node.title;
    node[field] = field === "priority" ? normalizePriority(event.target.value) : event.target.value;
    if (field === "title" && syncGoalFromTitleIfBlankOrSynced(node, event.target.value, previousTitle)) {
      const goalInput = $(`[data-node-id="${node.id}"] [data-inline-field="goal"]`, nodesLayer);
      if (goalInput) {
        goalInput.value = node.goal;
        goalInput.style.height = "auto";
        goalInput.style.height = `${goalInput.scrollHeight}px`;
      }
    }
    saveState();
    if (event.target.matches(".inline-textarea")) {
      event.target.style.height = "auto";
      event.target.style.height = `${event.target.scrollHeight}px`;
      renderEdges();
    }
  });

  document.addEventListener("paste", (event) => {
    const files = pastedImageFiles(event.clipboardData);
    if (!files.length) return;
    const node = nodeForImagePasteTarget(event.target);
    if (!node) return;
    event.preventDefault();
    addImagesToNode(node, files);
  });

  nodesLayer.addEventListener("change", (event) => {
    const quickStatusNodeId = event.target.dataset.quickStatus;
    if (quickStatusNodeId) {
      const node = nodeById(quickStatusNodeId);
      if (!node) return;
      const snapshot = JSON.stringify(state);
      const result = setNodeStatus(node, event.target.value);
      if (result.changedCount) {
        pushUndoSnapshot(snapshot);
        saveState();
      }
      if (!displayedNodeIds().has(node.id)) {
        selectedNodeId = null;
        pinnedInlineNodeIds.delete(node.id);
      }
      renderAll();
      showToast(statusChangeMessage(node, result));
      return;
    }
    const imageNodeId = event.target.dataset.nodeImage;
    if (imageNodeId) {
      const files = event.target.files;
      const node = nodeById(imageNodeId);
      if (!files?.length || !node) return;
      addImagesToNode(node, files);
      return;
    }
    const field = event.target.dataset.inlineField;
    const nodeEl = event.target.closest(".task-node");
    const node = nodeById(nodeEl?.dataset.nodeId);
    if (!field || !node) return;
    if (field === "status") {
      const snapshot = fieldUndoSnapshot || JSON.stringify(state);
      fieldUndoSnapshot = null;
      const result = setNodeStatus(node, event.target.value);
      if (result.changedCount) {
        pushUndoSnapshot(snapshot);
        saveState();
      }
      if (!displayedNodeIds().has(node.id)) {
        selectedNodeId = null;
        pinnedInlineNodeIds.delete(node.id);
      }
      renderAll();
      showToast(statusChangeMessage(node, result));
      return;
    }
    if (fieldUndoSnapshot) {
      pushUndoSnapshot(fieldUndoSnapshot);
      fieldUndoSnapshot = null;
    }
    node[field] = field === "priority" ? normalizePriority(event.target.value) : event.target.value;
    if (field === "priority") event.target.value = String(node[field]);
    if (field === "requester") {
      rememberPerson(node[field]);
      trackRequesterPublication(node);
    }
    saveState();
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
    if (field === "status") return;
    const previousTitle = node.title;
    node[field] = event.target.value;
    if (field === "title" && syncGoalFromTitleIfBlankOrSynced(node, event.target.value, previousTitle)) {
      const goalInput = $("#editGoal", editorContent);
      if (goalInput) goalInput.value = node.goal;
    }
    saveState();
    renderNodes();
    renderEdges();
  });

  editorContent.addEventListener("change", (event) => {
    if (event.target.id === "editNodeImage") {
      const node = nodeById(selectedNodeId);
      const files = event.target.files;
      if (!node || !files?.length) return;
      addImagesToNode(node, files);
      return;
    }
    const field = event.target.dataset.field;
    const node = nodeById(selectedNodeId);
    if (!field || !node) return;
    if (field === "status") {
      const snapshot = JSON.stringify(state);
      const result = setNodeStatus(node, event.target.value);
      if (result.changedCount) {
        pushUndoSnapshot(snapshot);
        saveState();
      }
      renderAll();
      showToast(statusChangeMessage(node, result));
      return;
    }
    node[field] = event.target.value;
    if (field === "title" && fillGoalFromTitleIfBlank(node)) {
      const goalInput = $("#editGoal", editorContent);
      if (goalInput) goalInput.value = node.goal;
    }
    if (field === "requester") {
      rememberPerson(node[field]);
      trackRequesterPublication(node);
    }
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
    if (event.target.closest("#deleteNodeButton")) deleteNode(selectedNodeId);
  });

  $("#nodeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const goal = String(form.get("goal") || "");
    createNode({ title, requester: form.get("requester"), type: form.get("type"), status: form.get("status"), goal: goal.trim() ? goal : title, note: form.get("note"), images: pendingImageData }, pendingNodePosition || visibleCenterPoint());
    closeModal("nodeModal");
    showToast("节点已创建");
  });

  $("#newNodeImage").addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []).slice(0, MAX_NODE_IMAGES);
    if (!files.length) return;
    Promise.all(files.map((file) => compressImage(file))).then((images) => {
      pendingImageData = images;
      const preview = $("#newImagePreview");
      preview.src = images[0];
      preview.alt = `待上传图片预览，共 ${images.length} 张`;
      preview.hidden = false;
      showToast(`已准备 ${images.length} 张图片`);
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

  $("#snapshotButton").addEventListener("click", saveCanvasSnapshot);
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
  $("#layoutButton").addEventListener("click", formatLayout);
  $("#downloadReportButton").addEventListener("click", downloadReport);
  $("#copyReportButton").addEventListener("click", copyReport);
  $("#fitButton").addEventListener("click", fitCanvas);
  $("#resetButton").addEventListener("click", () => {
    pushUndoSnapshot();
    state = defaultState();
    syncCollapsedBranchesFromState();
    selectedNodeId = null;
    pinnedInlineNodeIds.clear();
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
  document.addEventListener("click", (event) => {
    const removeImage = event.target.closest("[data-remove-node-image]");
    if (removeImage) {
      event.stopPropagation();
      const node = nodeById(removeImage.dataset.removeNodeImage);
      const index = Number(removeImage.dataset.imageIndex);
      if (!node || !Number.isInteger(index)) return;
      const previousImages = nodeImages(node);
      if (!previousImages[index]) return;
      pushUndoSnapshot();
      setNodeImages(node, previousImages.filter((_, imageIndex) => imageIndex !== index));
      if (!saveState()) {
        setNodeImages(node, previousImages);
        return;
      }
      renderAll();
      showToast("图片已移除");
      return;
    }
    const previewImage = event.target.closest("[data-preview-node-images]");
    if (previewImage) {
      const node = nodeById(previewImage.dataset.previewNodeImages);
      if (node) openImageLightbox(nodeImages(node), Number(previewImage.dataset.imageIndex));
    }
  });
  $("#imageLightboxClose").addEventListener("click", closeImageLightbox);
  $("#imageLightboxPrevious").addEventListener("click", () => moveImageLightbox(-1));
  $("#imageLightboxNext").addEventListener("click", () => moveImageLightbox(1));
  $("#imageLightbox").addEventListener("pointerdown", (event) => {
    if (event.target.id === "imageLightbox") closeImageLightbox();
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
      if (!$("#imageLightbox").hidden) closeImageLightbox();
      $("#dataTransferMenu").hidden = true;
      $("#dataTransferButton").setAttribute("aria-expanded", "false");
      $$(".modal-backdrop").forEach((modal) => modal.hidden = true);
      if (connectionSession) {
        connectionSession = null;
        draftEdge.hidden = true;
        draftEdge.setAttribute("d", "");
      }
    }
    if (!$("#imageLightbox").hidden && event.key === "ArrowLeft") moveImageLightbox(-1);
    if (!$("#imageLightbox").hidden && event.key === "ArrowRight") moveImageLightbox(1);
    const typingTarget = event.target.matches("input, textarea, select, [contenteditable='true']");
    if (event.key === "Delete" && !typingTarget && (selectedNodeId || multiSelectedNodeIds.size)) {
      event.preventDefault();
      deleteSelectedNodes();
    }
  });

  const preferredTheme = localStorage.getItem(THEME_KEY) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  rememberPeople(state.nodes.map((node) => node.requester), { promote: false, render: false });
  syncCollapsedBranchesFromState();
  syncRequesterPublicationStatsFromState();
  cleanupExpiredCompletedChains();
  applyTheme(preferredTheme);
  $("#todayLabel").textContent = formatDate();
  renderAll();
  saveState();
})();
