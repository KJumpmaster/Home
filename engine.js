const TREE_JSON_URL = "usa_tree_pass2_with_arrows.json";
const FLAGS_JSON_URL = "usa_tree_v4.json";
const REGISTRY_CSV_URL = "SP_Registry_CANON_3_31.csv";
const EDGES_CSV_URL = "usa_tree_pass2_edges.csv";
const PIC_BASE = "https://kjumpmaster.github.io/Aircraft-Pics/";

const EXEMPT_UNIT_IDS = new Set([
  // "example_unit_1",
  // "example_unit_2",
  // "example_unit_3"
].map(normId));

const treeShellEl = document.getElementById("treeShell");
const rankLayerEl = document.getElementById("rankLayer");
const edgeLayerEl = document.getElementById("edgeLayer");
const nodeLayerEl = document.getElementById("nodeLayer");
const detailPanelEl = document.getElementById("detailPanel");
const statusBoxEl = document.getElementById("statusBox");

const state = {
  registryByKey: new Map(),
  flagMap: new Map(),
  cells: [],
  edges: [],
  rectMap: new Map(),
  selectedUnitId: "",
  selectedCellId: ""
};

function setStatus(message, isError = false) {
  statusBoxEl.textContent = message;
  statusBoxEl.classList.toggle("error", !!isError);
}

window.addEventListener("error", (e) => {
  setStatus(`JS error: ${e.message} at ${e.filename || "inline"}:${e.lineno || 0}`, true);
});

window.addEventListener("unhandledrejection", (e) => {
  setStatus(`Promise error: ${e.reason?.message || e.reason || "Unknown promise failure"}`, true);
});

function normId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function firstNonBlank(values) {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return "";
}

function normalizeType(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function romanize(num) {
  const map = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let out = "";
  let n = Number(num) || 0;
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out || String(num);
}

function varNum(name) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some(v => String(v).length > 0)) rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }

  row.push(cur);
  if (row.some(v => String(v).length > 0)) rows.push(row);
  if (!rows.length) return [];

  const headers = rows[0].map(h => String(h || "").trim());
  return rows.slice(1).filter(r => r.some(v => String(v || "").trim() !== "")).map(r => {
    const obj = {};
    headers.forEach((h, idx) => obj[h] = r[idx] ?? "");
    return obj;
  });
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return await res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return await res.text();
}

function buildRegistryMap(rows) {
  const map = new Map();

  for (const row of rows) {
    const keys = [
      row.master_key,
      row.wt_name,
      row.wt_display_name_new,
      row.rw_name
    ].map(v => String(v || "").trim()).filter(Boolean);

    for (const key of keys) {
      map.set(key, row);
      map.set(normId(key), row);
    }
  }

  return map;
}

function collectObjectsDeep(root) {
  const out = [];
  const seen = new Set();

  (function walk(node) {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    const keys = Object.keys(node);
    const rowish = keys.some(k => /(^|_)(id|name|unit|plane|type|premium|event|pack|squadron)$/i.test(k));
    if (rowish) out.push(node);

    for (const value of Object.values(node)) walk(value);
  })(root);

  return out;
}

function buildFlagMap(flagJson) {
  const map = new Map();
  const rows = collectObjectsDeep(flagJson);

  for (const row of rows) {
    const typeText = normalizeType(firstNonBlank([
      row.vehicle_type, row.type, row.unit_type, row.classification, row.flag_type,
      row.reward_type, row.kind, row.class
    ]));

    const payload = {
      premium: typeText.includes("premium") || String(row.premium).toLowerCase() === "true",
      squadron: typeText.includes("squadron") || String(row.squadron).toLowerCase() === "true",
      event: typeText.includes("event") || String(row.event).toLowerCase() === "true",
      pack: typeText.includes("pack") || String(row.pack).toLowerCase() === "true"
    };

    const aliases = [
      row.unit_id, row.aircraft_id, row.id, row.name, row.plane, row.vehicle,
      row.value, row.master_key, row.wt_name, row.display_name, row.title
    ];

    for (const alias of aliases) {
      const raw = String(alias || "").trim();
      const nid = normId(raw);
      if (raw) map.set(raw, payload);
      if (nid) map.set(nid, payload);
    }
  }

  return map;
}

function getRegistryRow(unitId) {
  const raw = String(unitId || "").trim();
  return state.registryByKey.get(raw) || state.registryByKey.get(normId(raw)) || null;
}

function getCellUnitIds(cell) {
  const out = [];

  const add = (v) => {
    const raw = String(v || "").trim();
    const nid = normId(raw);
    if (raw) out.push(raw);
    if (nid) out.push(nid);
  };

  add(cell.master_key);
  add(cell.unit_id);
  add(cell.id);
  add(cell.cell_key);
  add(cell.name);
  add(cell.display_name);
  add(cell.title);

  if (Array.isArray(cell.units)) {
    for (const u of cell.units) {
      if (typeof u === "string") add(u);
      else if (u && typeof u === "object") add(firstNonBlank([u.unit_id, u.aircraft_id, u.id, u.master_key, u.name]));
    }
  }

  if (Array.isArray(cell.members)) {
    for (const u of cell.members) {
      if (typeof u === "string") add(u);
      else if (u && typeof u === "object") add(firstNonBlank([u.unit_id, u.aircraft_id, u.id, u.master_key, u.name]));
    }
  }

  return [...new Set(out.filter(Boolean))];
}

function classifyUnit(unitId, fallbackCell = null) {
  const candidates = new Set();

  const add = (v) => {
    const raw = String(v || "").trim();
    if (raw) candidates.add(raw);
    const nid = normId(raw);
    if (nid) candidates.add(nid);
  };

  add(unitId);

  if (fallbackCell) {
    add(fallbackCell.master_key);
    add(fallbackCell.unit_id);
    add(fallbackCell.id);
    add(fallbackCell.cell_key);
    add(fallbackCell.name);
    add(fallbackCell.display_name);
    add(fallbackCell.title);
  }

  const reg = getRegistryRow(unitId);
  if (reg) {
    add(reg.master_key);
    add(reg.wt_name);
    add(reg.wt_display_name_new);
    add(reg.rw_name);
  }

  for (const c of candidates) {
    const hit = state.flagMap.get(c);
    if (!hit) continue;
    if (hit.squadron) return "squadron";
    if (hit.event) return "event";
    if (hit.pack) return "pack";
    if (hit.premium) return "premium";
  }

  return "tech";
}

function buildImageUrl(registryRow, unitId) {
  const wtImage = String(registryRow?.wt_image || "").trim();
  const masterKey = String(registryRow?.master_key || unitId || "").trim();

  if (wtImage) {
    if (/^https?:\/\//i.test(wtImage)) return wtImage;
    if (/\.(png|jpg|jpeg|webp)$/i.test(wtImage)) return `${PIC_BASE}${wtImage}`;
    return `${PIC_BASE}${wtImage}.png`;
  }

  if (masterKey) return `${PIC_BASE}${masterKey}.png`;
  return "";
}

function prepareCells(rawCells) {
  const cells = [];

  rawCells.forEach((raw, idx) => {
    const rank = Number(raw.rank);
    const column = Number(raw.column ?? raw.col);
    const row = Number(raw.row_in_rank ?? raw.row);

    if (!Number.isFinite(rank) || !Number.isFinite(column) || !Number.isFinite(row)) return;
    if (rank < 1 || column < 1 || row < 1) return;

    const unitIds = getCellUnitIds(raw).filter(id => !EXEMPT_UNIT_IDS.has(normId(id)));
    if (!unitIds.length) return;

    const primaryUnitId = unitIds[0];
    const registryRow = getRegistryRow(primaryUnitId);

    cells.push({
      ...raw,
      cell_id: raw.cell_id || raw.cell_key || raw.id || `cell_${idx}`,
      cell_key: raw.cell_key || raw.cell_id || raw.id || `cell_${idx}`,
      rank,
      column,
      row,
      unitIds,
      primaryUnitId,
      isGroup: unitIds.length > 1,
      registryRow,
      displayTitle:
        raw.display_name ||
        raw.wiki_name ||
        raw.name ||
        raw.title ||
        registryRow?.wt_display_name_new ||
        registryRow?.wt_name ||
        registryRow?.rw_name ||
        primaryUnitId,
      mainType: classifyUnit(primaryUnitId, raw),
      imageUrl: buildImageUrl(registryRow, primaryUnitId)
    });
  });

  return cells;
}

function computeRankLayout(cells) {
  const rowsByRank = new Map();
  for (const cell of cells) {
    rowsByRank.set(cell.rank, Math.max(rowsByRank.get(cell.rank) || 0, cell.row));
  }

  const ranks = [...rowsByRank.keys()].sort((a, b) => a - b);
  const rankLayout = new Map();
  let y = varNum("--tree-pad");

  for (const rank of ranks) {
    const rows = rowsByRank.get(rank) || 1;
    const contentH = rows * varNum("--cell-h") + Math.max(0, rows - 1) * varNum("--cell-gap-y");
    const bandH = varNum("--rank-header-h") + varNum("--rank-inner-top") + contentH + varNum("--rank-inner-bottom");
    rankLayout.set(rank, { y, height: bandH, rows });
    y += bandH + varNum("--rank-gap");
  }

  const maxCol = Math.max(...cells.map(c => Number(c.column) || 0), 7);
  const width = varNum("--tree-pad") * 2 + maxCol * varNum("--cell-w") + (maxCol - 1) * varNum("--cell-gap-x");
  const height = y + varNum("--tree-pad") - varNum("--rank-gap");

  return { rankLayout, width, height };
}

function getCellRect(cell, rankLayout) {
  const layout = rankLayout.get(Number(cell.rank));
  return {
    x: varNum("--tree-pad") + (Number(cell.column) - 1) * (varNum("--cell-w") + varNum("--cell-gap-x")),
    y: layout.y + varNum("--rank-header-h") + varNum("--rank-inner-top") + (Number(cell.row) - 1) * (varNum("--cell-h") + varNum("--cell-gap-y")),
    w: varNum("--cell-w"),
    h: varNum("--cell-h")
  };
}

function renderRankBands(rankLayout, width) {
  rankLayerEl.innerHTML = "";
  for (const [rank, layout] of [...rankLayout.entries()].sort((a, b) => a[0] - b[0])) {
    const band = document.createElement("div");
    band.className = "rank-band";
    band.style.left = "0px";
    band.style.top = `${layout.y}px`;
    band.style.width = `${width}px`;
    band.style.height = `${layout.height}px`;

    const label = document.createElement("div");
    label.className = "rank-label";
    label.textContent = `Rank ${romanize(rank)}`;

    band.appendChild(label);
    rankLayerEl.appendChild(band);
  }
}

function createCellElement(cell) {
  const el = document.createElement("div");
  el.className = `tree-cell ${cell.mainType}`;
  el.dataset.cellId = cell.cell_id;

  el.innerHTML = `
    <div class="cell-accent"></div>
    <div class="cell-top">
      <div class="cell-image-wrap"></div>
    </div>
    <div class="cell-body">
      <div class="cell-title"></div>
      <div class="cell-meta">
        <span>${escapeHTML(cell.primaryUnitId)}</span>
        <span>${escapeHTML(`R${cell.rank} C${cell.column} Y${cell.row}`)}</span>
      </div>
      <div class="badge-row">
        <span class="tag ${cell.mainType}">${cell.mainType}</span>
      </div>
    </div>
  `;

  el.querySelector(".cell-title").textContent = cell.displayTitle;

  const imgWrap = el.querySelector(".cell-image-wrap");
  if (cell.imageUrl) {
    const img = document.createElement("img");
    img.className = "cell-image";
    img.alt = cell.displayTitle;
    img.src = cell.imageUrl;
    imgWrap.appendChild(img);
  } else {
    const fallback = document.createElement("div");
    fallback.className = "cell-fallback";
    fallback.textContent = "No Image";
    imgWrap.appendChild(fallback);
  }

  el.addEventListener("click", () => selectCell(cell));
  return el;
}

function renderCells(cells, rankLayout) {
  nodeLayerEl.innerHTML = "";
  const rectMap = new Map();

  for (const cell of cells) {
    const rect = getCellRect(cell, rankLayout);
    rectMap.set(cell.cell_id, rect);

    const wrap = document.createElement("div");
    wrap.className = "cell-wrap";
    wrap.style.left = `${rect.x}px`;
    wrap.style.top = `${rect.y}px`;
    wrap.appendChild(createCellElement(cell));

    nodeLayerEl.appendChild(wrap);
  }

  return rectMap;
}

function buildVisibleEdges(edgeRows, cellsById) {
  const edges = [];
  const seen = new Set();

  function resolveCell(ref) {
    const raw = String(ref || "").trim();
    const nid = normId(raw);
    return cellsById.get(raw) || cellsById.get(nid) || null;
  }

  for (const row of edgeRows) {
    const fromRef = firstNonBlank([
      row.from_id, row.from, row.source, row.parent, row.parent_id, row.source_cell_key
    ]);
    const toRef = firstNonBlank([
      row.to_id, row.to, row.target, row.child, row.child_id, row.target_cell_key
    ]);

    const fromCell = resolveCell(fromRef);
    const toCell = resolveCell(toRef);

    if (!fromCell || !toCell || fromCell.cell_id === toCell.cell_id) continue;

    const key = `${fromCell.cell_id}__${toCell.cell_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    edges.push({
      fromId: fromCell.primaryUnitId,
      toId: toCell.primaryUnitId,
      fromRef: fromCell.cell_id,
      toRef: toCell.cell_id
    });
  }

  return edges;
}

function ensureArrowMarkers(svg) {
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

  const blue = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  blue.setAttribute("id", "arrowhead-blue");
  blue.setAttribute("markerWidth", "8");
  blue.setAttribute("markerHeight", "8");
  blue.setAttribute("refX", "7");
  blue.setAttribute("refY", "4");
  blue.setAttribute("orient", "auto");
  blue.setAttribute("markerUnits", "strokeWidth");

  const bluePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  bluePath.setAttribute("d", "M 0 0 L 8 4 L 0 8 Z");
  bluePath.setAttribute("class", "edge-head-blue");
  blue.appendChild(bluePath);

  defs.appendChild(blue);
  svg.appendChild(defs);
}

function renderEdges() {
  edgeLayerEl.innerHTML = "";

  const width = parseFloat(treeShellEl.style.width) || 0;
  const height = parseFloat(treeShellEl.style.height) || 0;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  ensureArrowMarkers(svg);

  for (const edge of state.edges) {
    const fromRect = state.rectMap.get(edge.fromRef);
    const toRect = state.rectMap.get(edge.toRef);
    if (!fromRect || !toRect) continue;

    const a = { x: fromRect.x + fromRect.w, y: fromRect.y + fromRect.h / 2 };
    const b = { x: toRect.x, y: toRect.y + toRect.h / 2 };
    const midX = Math.round((a.x + b.x) / 2);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`);
    path.setAttribute("class", "edge-path");
    path.setAttribute("marker-end", "url(#arrowhead-blue)");
    svg.appendChild(path);
  }

  edgeLayerEl.appendChild(svg);
}

function renderDetail(cell) {
  detailPanelEl.innerHTML = `
    <div class="empty-state">
      <strong>${escapeHTML(cell.displayTitle)}</strong><br><br>
      Unit ID: ${escapeHTML(cell.primaryUnitId || "—")}<br>
      Type: ${escapeHTML(cell.mainType)}<br>
      Rank: ${escapeHTML(cell.rank)} | Column: ${escapeHTML(cell.column)} | Row: ${escapeHTML(cell.row)}<br>
      Nation: ${escapeHTML(cell.registryRow?.nation || "STILL_NOT_FOUND")}<br>
      WT Name: ${escapeHTML(cell.registryRow?.wt_name || "—")}<br>
      Master Key: ${escapeHTML(cell.registryRow?.master_key || "—")}
    </div>
  `;
}

function selectCell(cell) {
  state.selectedCellId = cell.cell_id;
  state.selectedUnitId = cell.primaryUnitId || "";

  document.querySelectorAll(".tree-cell.active").forEach(el => el.classList.remove("active"));
  const activeEl = document.querySelector(`.tree-cell[data-cell-id="${cell.cell_id}"]`);
  if (activeEl) activeEl.classList.add("active");

  renderDetail(cell);
}

async function initResearchPage() {
  setStatus("Loading tree, flags, registry, and edge truth...");

  const [treePayload, flagsPayload, regText, edgeText] = await Promise.all([
    fetchJSON(TREE_JSON_URL),
    fetchJSON(FLAGS_JSON_URL),
    fetchText(REGISTRY_CSV_URL),
    fetchText(EDGES_CSV_URL)
  ]);

  state.registryByKey = buildRegistryMap(parseCSV(regText));
  state.flagMap = buildFlagMap(flagsPayload);

  const rawCells = Array.isArray(treePayload.cells) ? treePayload.cells : [];
  state.cells = prepareCells(rawCells);

  if (!state.cells.length) {
    throw new Error("No valid cells found in tree JSON.");
  }

  const cellsById = new Map();
  for (const cell of state.cells) {
    cellsById.set(cell.cell_id, cell);
    cellsById.set(normId(cell.cell_id), cell);
    cellsById.set(cell.cell_key, cell);
    cellsById.set(normId(cell.cell_key), cell);
    cellsById.set(cell.primaryUnitId, cell);
    cellsById.set(normId(cell.primaryUnitId), cell);
  }

  state.edges = buildVisibleEdges(parseCSV(edgeText), cellsById);

  const { rankLayout, width, height } = computeRankLayout(state.cells);
  treeShellEl.style.width = `${width}px`;
  treeShellEl.style.height = `${height}px`;

  renderRankBands(rankLayout, width);
  state.rectMap = renderCells(state.cells, rankLayout);
  renderEdges();

  const first = state.cells[0];
  if (first) selectCell(first);

  const counts = { tech: 0, premium: 0, squadron: 0, event: 0, pack: 0 };
  for (const cell of state.cells) counts[cell.mainType] = (counts[cell.mainType] || 0) + 1;

  setStatus(
`Loaded OK
Tree: ${TREE_JSON_URL}
Flags: ${FLAGS_JSON_URL}
Registry: ${REGISTRY_CSV_URL}
Edges: ${EDGES_CSV_URL}
Visible cells: ${state.cells.length}
Drawn arrows: ${state.edges.length}
Premium: ${counts.premium} | Squadron: ${counts.squadron} | Event: ${counts.event} | Pack: ${counts.pack}
Flag rows indexed: ${state.flagMap.size}`
  );
}

if (document.getElementById("treeShell")) {
  initResearchPage();
}
