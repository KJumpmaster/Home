const TREE_JSON_URL = "usa_tree_pass2_with_arrows.json";
const FLAGS_JSON_URL = "usa_tree_v4.json";
const REGISTRY_CSV_URL = "SP_Registry_CANON_3_31.csv";
const EDGES_CSV_URL = "usa_tree_pass2_edges.csv";
const PIC_BASE = "https://kjumpmaster.github.io/Aircraft-Pics/";

const CELL_HEIGHT_SCALE = 0.80;
const IMAGE_SCALE = 0.80;

const EXEMPT_UNIT_IDS = new Set([
  "ucav",
  "quadcopter",
  "o3u_1"
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
  selectedCellId: "",
  selectedUnitId: "",
  arrowSourceUsed: "csv"
};

function setStatus(message, isError = false) {
  if (!statusBoxEl) return;
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

function normalizeType(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeKey(value) {
  return String(value || "").trim();
}

function firstNonBlank(values) {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return "";
}

function toBool(v) {
  if (v === true || v === 1) return true;
  const s = String(v || "").trim().toLowerCase();
  return ["true", "1", "yes", "y", "t"].includes(s);
}

function romanize(num) {
  const map = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
  ];
  let out = "";
  let n = Number(num) || 0;
  for (const [v, s] of map) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out || String(num);
}

function varNum(name) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

function scaledCellH() {
  return varNum("--cell-h") * CELL_HEIGHT_SCALE;
}

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cssEscape(v) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(v);
  return String(v).replace(/([ #;?%&,.+*~\\':"!^$\[\]()=>|/])/g, "\\$1");
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
  return rows.slice(1)
    .filter(r => r.some(v => String(v || "").trim() !== ""))
    .map(r => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] ?? "";
      });
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
    const rowish = keys.some(k => /(^|_)(id|name|unit|plane|type|premium|event|pack|squadron|vehicle|classification|reward)$/i.test(k));
    if (rowish) out.push(node);

    for (const value of Object.values(node)) walk(value);
  })(root);

  return out;
}

function buildRegistryMap(rows) {
  const map = new Map();

  for (const row of rows) {
    const keys = [
      row.master_key,
      row.wt_name,
      row.wt_display_name_new,
      row.rw_name,
      row.wt_image,
      row.rw_image_name
    ].map(v => String(v || "").trim()).filter(Boolean);

    for (const rawKey of keys) {
      const exact = String(rawKey).trim();
      const normalized = normId(rawKey);
      if (exact && !map.has(exact)) map.set(exact, row);
      if (normalized && !map.has(normalized)) map.set(normalized, row);
    }
  }

  return map;
}

function buildFlagMap(flagJson) {
  const map = new Map();
  const rows = collectObjectsDeep(flagJson);

  function addAlias(alias, payload) {
    const raw = String(alias || "").trim();
    const nid = normId(raw);
    if (!raw && !nid) return;

    const existing = map.get(raw) || map.get(nid) || {
      premium: false,
      squadron: false,
      event: false,
      pack: false
    };

    existing.premium = existing.premium || !!payload.premium;
    existing.squadron = existing.squadron || !!payload.squadron;
    existing.event = existing.event || !!payload.event;
    existing.pack = existing.pack || !!payload.pack;

    if (raw) map.set(raw, existing);
    if (nid) map.set(nid, existing);
  }

  for (const row of rows) {
    const typeText = normalizeType(firstNonBlank([
      row.vehicle_type,
      row.type,
      row.unit_type,
      row.classification,
      row.flag_type,
      row.reward_type,
      row.kind,
      row.class,
      row.category,
      row.vehicle_class
    ]));

    const allText = normalizeType(Object.values(row).map(v => String(v || "")).join(" | "));

    const payload = {
      premium: toBool(row.premium) || typeText.includes("premium") || allText.includes("premium"),
      squadron: toBool(row.squadron) || typeText.includes("squadron") || allText.includes("squadron"),
      event: toBool(row.event) || typeText.includes("event") || allText.includes("event"),
      pack: toBool(row.pack) || typeText.includes("pack") || allText.includes("pack")
    };

    [
      row.unit_id, row.aircraft_id, row.id, row.name, row.plane, row.vehicle,
      row.value, row.master_key, row.wt_name, row.display_name, row.title,
      row.cell_id, row.cell_key, row.node_id, row.key
    ].forEach(v => addAlias(v, payload));

    for (const v of Object.values(row)) {
      if (typeof v !== "string") continue;
      const s = v.trim();
      if (!s || s.length > 140) continue;
      addAlias(s, payload);
    }
  }

  return map;
}

function getRegistryRowByUnitId(unitId) {
  const raw = String(unitId || "").trim();
  const normalized = normId(unitId);
  return state.registryByKey.get(raw) || state.registryByKey.get(normalized) || null;
}

function getCellMasterKey(cell) {
  return normalizeKey(firstNonBlank([
    cell.master_key,
    cell.cell_key,
    cell.unit_id,
    cell.id,
    cell.key,
    Array.isArray(cell.units) && cell.units.length
      ? (typeof cell.units[0] === "string"
          ? cell.units[0]
          : firstNonBlank([cell.units[0].unit_id, cell.units[0].id, cell.units[0].master_key]))
      : ""
  ]));
}

function getCellUnitIds(cell) {
  const out = [];

  const pushMaybe = (v) => {
    const raw = String(v || "").trim();
    const n = normId(v);
    if (raw) out.push(raw);
    if (n) out.push(n);
  };

  pushMaybe(cell.master_key);
  pushMaybe(cell.cell_key);
  pushMaybe(cell.unit_id);
  pushMaybe(cell.id);
  pushMaybe(cell.key);
  pushMaybe(cell.name);
  pushMaybe(cell.display_name);
  pushMaybe(cell.title);

  if (Array.isArray(cell.units)) {
    for (const u of cell.units) {
      if (typeof u === "string") {
        pushMaybe(u);
      } else if (u && typeof u === "object") {
        pushMaybe(firstNonBlank([
          u.unit_id, u.aircraft_id, u.id, u.master_key, u.name, u.title, u.display_name
        ]));
      }
    }
  }

  if (Array.isArray(cell.members)) {
    for (const u of cell.members) {
      if (typeof u === "string") {
        pushMaybe(u);
      } else if (u && typeof u === "object") {
        pushMaybe(firstNonBlank([
          u.unit_id, u.aircraft_id, u.id, u.master_key, u.name, u.title, u.display_name
        ]));
      }
    }
  }

  return [...new Set(out.filter(Boolean))];
}

function getRenderableUnitIds(cell) {
  return getCellUnitIds(cell).filter(id => !EXEMPT_UNIT_IDS.has(normId(id)));
}

function classifyUnit(unitId, fallbackCell = null) {
  const candidates = new Set();

  const add = (v) => {
    const raw = String(v || "").trim();
    const nid = normId(raw);
    if (raw) candidates.add(raw);
    if (nid) candidates.add(nid);
  };

  add(unitId);

  if (fallbackCell) {
    add(fallbackCell.master_key);
    add(fallbackCell.cell_key);
    add(fallbackCell.unit_id);
    add(fallbackCell.id);
    add(fallbackCell.key);
    add(fallbackCell.name);
    add(fallbackCell.display_name);
    add(fallbackCell.title);
    add(fallbackCell.node_id);
  }

  const reg = getRegistryRowByUnitId(unitId);
  if (reg) {
    add(reg.master_key);
    add(reg.wt_name);
    add(reg.wt_display_name_new);
    add(reg.rw_name);
    add(reg.wt_image);
    add(reg.rw_image_name);
  }

  if (fallbackCell) {
    if (toBool(fallbackCell.squadron)) return "squadron";
    if (toBool(fallbackCell.event)) return "event";
    if (toBool(fallbackCell.pack)) return "pack";
    if (toBool(fallbackCell.premium)) return "premium";
  }

  for (const key of candidates) {
    const f = state.flagMap.get(key);
    if (!f) continue;
    if (f.squadron) return "squadron";
    if (f.event) return "event";
    if (f.pack) return "pack";
    if (f.premium) return "premium";
  }

  if (fallbackCell) {
    const cellTypeText = normalizeType(firstNonBlank([
      fallbackCell.type,
      fallbackCell.vehicle_type,
      fallbackCell.group_type,
      fallbackCell.kind,
      fallbackCell.class,
      fallbackCell.reward_type,
      fallbackCell.classification,
      fallbackCell.flag_type,
      fallbackCell.category,
      fallbackCell.vehicle_class
    ]));

    const nameText = normalizeType(firstNonBlank([
      fallbackCell.display_name,
      fallbackCell.wiki_name,
      fallbackCell.name,
      fallbackCell.title,
      fallbackCell.master_key,
      fallbackCell.unit_id
    ]));

    const megaText = `${cellTypeText} | ${nameText}`;

    if (megaText.includes("squadron")) return "squadron";
    if (megaText.includes("event")) return "event";
    if (megaText.includes("pack")) return "pack";
    if (megaText.includes("premium")) return "premium";
  }

  return "tech";
}

function summarizeGroupTypes(unitIds, fallbackCell = null) {
  const counts = { tech: 0, premium: 0, squadron: 0, event: 0, pack: 0 };
  for (const id of unitIds) {
    const t = classifyUnit(id, fallbackCell);
    counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}

function pickMainType(unitIds, fallbackCell = null) {
  const counts = summarizeGroupTypes(unitIds, fallbackCell);
  if (counts.squadron > 0) return "squadron";
  if (counts.event > 0) return "event";
  if (counts.pack > 0) return "pack";
  if (counts.premium > 0) return "premium";
  return "tech";
}

function buildImageCandidates(registryRow, unitId) {
  const out = [];
  const wtImage = normalizeKey(registryRow?.wt_image);
  const masterKey = normalizeKey(registryRow?.master_key || unitId);

  if (wtImage) {
    if (/^https?:\/\//i.test(wtImage)) out.push(wtImage);
    else if (/\.(png|jpg|jpeg|webp)$/i.test(wtImage)) out.push(`${PIC_BASE}${wtImage}`);
    else out.push(`${PIC_BASE}${wtImage}.png`);
  }

  if (masterKey) out.push(`${PIC_BASE}${masterKey}.png`);

  return [...new Set(out)];
}

function resolveImageURL(registryRow, unitId) {
  const candidates = buildImageCandidates(registryRow, unitId);
  return candidates[0] || null;
}

function getDisplayName(cell, registryRow) {
  return (
    cell.display_name ||
    cell.wiki_name ||
    cell.name ||
    cell.title ||
    registryRow?.wt_display_name_new ||
    registryRow?.wt_name ||
    registryRow?.rw_name ||
    getCellMasterKey(cell) ||
    "Unknown Aircraft"
  );
}

function normalizeCell(raw, idx) {
  const rank = Number(raw.rank);
  const column = Number(raw.column ?? raw.col);
  const row = Number(raw.row_in_rank ?? raw.row);
  const cellId = raw.cell_id || raw.cell_key || raw.id || raw.node_id || raw.key || `${getCellMasterKey(raw) || "cell"}_${idx}`;

  return {
    ...raw,
    rank,
    column,
    row,
    cell_id: cellId,
    cell_key: raw.cell_key || cellId
  };
}

function validateCellPlacement(cell) {
  return Number.isFinite(cell.rank) &&
    Number.isFinite(cell.column) &&
    Number.isFinite(cell.row) &&
    cell.rank >= 1 &&
    cell.column >= 1 &&
    cell.row >= 1;
}

function getRowCountsByRank(cells) {
  const result = new Map();
  for (const cell of cells) {
    const rank = Number(cell.rank);
    const existing = result.get(rank) || 0;
    result.set(rank, Math.max(existing, Number(cell.row) || 1));
  }
  return result;
}

function getMaxColumn(cells) {
  return Math.max(...cells.map(c => Number(c.column) || 0), 7);
}

function computeRankLayout(cells) {
  const rowCountsByRank = getRowCountsByRank(cells);
  const ranks = [...rowCountsByRank.keys()].sort((a, b) => a - b);
  const rankLayout = new Map();
  let y = varNum("--tree-pad");

  for (const rank of ranks) {
    const rows = rowCountsByRank.get(rank) || 1;
    const contentH = rows * scaledCellH() + Math.max(0, rows - 1) * varNum("--cell-gap-y");
    const bandH = varNum("--rank-header-h") + varNum("--rank-inner-top") + contentH + varNum("--rank-inner-bottom");
    rankLayout.set(rank, { y, height: bandH, rows });
    y += bandH + varNum("--rank-gap");
  }

  const maxCol = getMaxColumn(cells);
  const width = varNum("--tree-pad") * 2 + maxCol * varNum("--cell-w") + (maxCol - 1) * varNum("--cell-gap-x");
  const height = y + varNum("--tree-pad") - varNum("--rank-gap");
  return { rankLayout, width, height };
}

function getCellRect(cell, rankLayout) {
  const layout = rankLayout.get(Number(cell.rank));
  return {
    x: varNum("--tree-pad") + (Number(cell.column) - 1) * (varNum("--cell-w") + varNum("--cell-gap-x")),
    y: layout.y + varNum("--rank-header-h") + varNum("--rank-inner-top") + (Number(cell.row) - 1) * (scaledCellH() + varNum("--cell-gap-y")),
    w: varNum("--cell-w"),
    h: scaledCellH()
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

function buildMember(unitId, fallbackCell, registryRow) {
  const row = registryRow || getRegistryRowByUnitId(unitId) || null;
  return {
    unitId: normId(unitId) || String(unitId || "").trim(),
    type: classifyUnit(unitId, fallbackCell),
    displayName: row?.wt_display_name_new || row?.wt_name || row?.rw_name || fallbackCell.display_name || fallbackCell.title || fallbackCell.name || unitId,
    registryRow: row,
    imageUrl: resolveImageURL(row, unitId)
  };
}

function prepareCells(rawCells) {
  const validCells = rawCells.map(normalizeCell).filter(validateCellPlacement);
  const prepared = [];

  for (const raw of validCells) {
    const unitIds = getRenderableUnitIds(raw);
    if (!unitIds.length) continue;

    const primaryUnitId = unitIds[0];
    const registryRow = getRegistryRowByUnitId(primaryUnitId) || getRegistryRowByUnitId(getCellMasterKey(raw)) || null;
    const members = unitIds.map(uid => buildMember(uid, raw, registryRow));
    const mainType = pickMainType(unitIds, raw);
    const groupCounts = summarizeGroupTypes(unitIds, raw);

    prepared.push({
      ...raw,
      unitIds,
      primaryUnitId,
      members,
      isGroup: unitIds.length > 1 || (Array.isArray(raw.units) && raw.units.length > 1) || (Array.isArray(raw.members) && raw.members.length > 1),
      mainType,
      groupCounts,
      displayTitle: getDisplayName(raw, registryRow)
    });
  }

  return prepared;
}

function createCellElement(cell) {
  const el = document.createElement("div");
  el.className = `tree-cell ${cell.mainType}`;
  el.dataset.cellId = cell.cell_id;
  el.dataset.unitId = cell.primaryUnitId;
  el.style.width = `${varNum("--cell-w")}px`;
  el.style.height = `${scaledCellH()}px`;

  const lead = cell.members[0] || null;
  const metaRight = cell.isGroup ? `${cell.members.length} aircraft` : `R${cell.rank} C${cell.column} Y${cell.row}`;
  const badges = [`<span class="tag ${cell.mainType}">${cell.mainType}</span>`];
  if (cell.isGroup) badges.push('<span class="tag group">Group</span>');

  el.innerHTML = `
    <div class="cell-accent"></div>
    ${cell.isGroup ? `<div class="group-corner">${cell.members.length}</div>` : ""}
    <div class="cell-top"><div class="cell-image-wrap"></div></div>
    <div class="cell-body">
      <div class="cell-title"></div>
      <div class="cell-meta">
        <span>${cell.primaryUnitId ? escapeHTML(cell.primaryUnitId) : ""}</span>
        <span>${escapeHTML(metaRight)}</span>
      </div>
      <div class="badge-row">${badges.join("")}</div>
    </div>
  `;

  el.querySelector(".cell-title").textContent = cell.displayTitle;

  const topEl = el.querySelector(".cell-top");
  const imgWrap = el.querySelector(".cell-image-wrap");
  const bodyEl = el.querySelector(".cell-body");
  const titleEl = el.querySelector(".cell-title");

  if (topEl) {
    topEl.style.flex = "0 0 auto";
    topEl.style.height = `${Math.max(44, Math.round(56 * IMAGE_SCALE))}px`;
  }

  if (imgWrap) {
    imgWrap.style.height = `${Math.max(40, Math.round(52 * IMAGE_SCALE))}px`;
    imgWrap.style.display = "flex";
    imgWrap.style.alignItems = "center";
    imgWrap.style.justifyContent = "center";
  }

  if (bodyEl) {
    bodyEl.style.minHeight = "0";
  }

  if (titleEl) {
    titleEl.style.lineHeight = "1.05";
  }

  if (lead && lead.imageUrl) {
    const img = document.createElement("img");
    img.className = "cell-image";
    img.alt = cell.displayTitle;
    img.src = lead.imageUrl;
    img.style.maxWidth = `${Math.round(110 * IMAGE_SCALE)}px`;
    img.style.maxHeight = `${Math.round(48 * IMAGE_SCALE)}px`;
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
    wrap.className = "cell-wrap" + (cell.isGroup ? " grouped" : "");
    wrap.style.left = `${rect.x}px`;
    wrap.style.top = `${rect.y}px`;
    wrap.style.width = `${rect.w}px`;
    wrap.style.height = `${rect.h}px`;

    if (cell.isGroup) {
      const s2 = document.createElement("div");
      s2.className = "cell-shadow-2";
      s2.style.width = `${rect.w}px`;
      s2.style.height = `${rect.h}px`;

      const s1 = document.createElement("div");
      s1.className = "cell-shadow-1";
      s1.style.width = `${rect.w}px`;
      s1.style.height = `${rect.h}px`;

      wrap.appendChild(s2);
      wrap.appendChild(s1);
    }

    wrap.appendChild(createCellElement(cell));
    nodeLayerEl.appendChild(wrap);
  }

  return rectMap;
}

function getRectAnchor(rect, side) {
  if (side === "right") return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
  return { x: rect.x, y: rect.y + rect.h / 2 };
}

function makeCurvedPath(a, b) {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.34);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

function ensureArrowMarkers(svg) {
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

  const blue = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  blue.setAttribute("id", "arrowhead-blue");
  blue.setAttribute("markerWidth", "14");
  blue.setAttribute("markerHeight", "14");
  blue.setAttribute("refX", "11.5");
  blue.setAttribute("refY", "7");
  blue.setAttribute("orient", "auto");
  blue.setAttribute("markerUnits", "userSpaceOnUse");

  const bluePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  bluePath.setAttribute("d", "M 0 0 L 14 7 L 0 14 Z");
  bluePath.setAttribute("fill", "rgba(125, 190, 255, 0.92)");
  blue.appendChild(bluePath);

  const gold = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  gold.setAttribute("id", "arrowhead-gold");
  gold.setAttribute("markerWidth", "14");
  gold.setAttribute("markerHeight", "14");
  gold.setAttribute("refX", "11.5");
  gold.setAttribute("refY", "7");
  gold.setAttribute("orient", "auto");
  gold.setAttribute("markerUnits", "userSpaceOnUse");

  const goldPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  goldPath.setAttribute("d", "M 0 0 L 14 7 L 0 14 Z");
  goldPath.setAttribute("fill", "rgba(255, 221, 110, 0.98)");
  gold.appendChild(goldPath);

  defs.appendChild(blue);
  defs.appendChild(gold);
  svg.appendChild(defs);
}

function buildVisibleEdges(rows, visibleUnitSet, cellsById) {
  const edges = [];
  const seen = new Set();

  function addEdge(fromCell, toCell, row, sourceTag) {
    if (!fromCell || !toCell) return;
    if (fromCell.cell_id === toCell.cell_id) return;

    const key = `${fromCell.cell_id}__${toCell.cell_id}`;
    if (seen.has(key)) return;
    seen.add(key);

    edges.push({
      fromId: fromCell.primaryUnitId,
      toId: toCell.primaryUnitId,
      fromRef: fromCell.cell_id,
      toRef: toCell.cell_id,
      raw: row,
      sourceTag
    });
  }

  function resolveCell(ref) {
    const raw = String(ref || "").trim();
    const nid = normId(raw);
    if (!raw && !nid) return null;

    return (
      cellsById.get(raw) ||
      cellsById.get(nid) ||
      state.cells.find(c =>
        c.cell_id === raw ||
        c.cell_key === raw ||
        normId(c.cell_id) === nid ||
        normId(c.cell_key) === nid ||
        c.unitIds.includes(raw) ||
        c.unitIds.includes(nid) ||
        c.primaryUnitId === raw ||
        c.primaryUnitId === nid ||
        normId(c.displayTitle) === nid ||
        normId(c.master_key) === nid ||
        normId(c.name) === nid ||
        normId(c.title) === nid ||
        normId(c.node_id) === nid ||
        normId(c.id) === nid
      ) ||
      null
    );
  }

  for (const row of rows) {
    const fromRef = firstNonBlank([
      row.from_id, row.from, row.source, row.parent, row.parent_id,
      row.source_cell_key, row.src, row.From, row.Source, row.Parent,
      row.source_id, row.start, row.a, row.u, row.unit_from, row.cell_from,
      row.from_cell, row.source_node, row.parent_cell, row.parent_unit
    ]);

    const toRef = firstNonBlank([
      row.to_id, row.to, row.target, row.child, row.child_id,
      row.target_cell_key, row.dst, row.To, row.Target, row.Child,
      row.target_id, row.end, row.b, row.v, row.unit_to, row.cell_to,
      row.to_cell, row.target_node, row.child_cell, row.child_unit
    ]);

    if (fromRef && toRef) {
      addEdge(resolveCell(fromRef), resolveCell(toRef), row, "explicit-fields");
      continue;
    }

    if (Array.isArray(row.path) && row.path.length >= 2) {
      addEdge(resolveCell(row.path[0]), resolveCell(row.path[row.path.length - 1]), row, "path-array");
      continue;
    }

    if (typeof row.path === "string" && row.path.trim()) {
      const parts = row.path.split(/>|,|;/).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        addEdge(resolveCell(parts[0]), resolveCell(parts[parts.length - 1]), row, "path-string");
        continue;
      }
    }

    const compactRefs = Object.values(row)
      .map(v => String(v || "").trim())
      .filter(Boolean)
      .filter(v => v.length < 120);

    if (compactRefs.length >= 2) {
      const maybeFrom = resolveCell(compactRefs[0]);
      const maybeTo = resolveCell(compactRefs[1]);
      if (maybeFrom && maybeTo) {
        addEdge(maybeFrom, maybeTo, row, "fallback-first-two");
      }
    }
  }

  return edges;
}

function renderEdges() {
  edgeLayerEl.innerHTML = "";

  const width = parseFloat(treeShellEl.style.width) || treeShellEl.clientWidth || 0;
  const height = parseFloat(treeShellEl.style.height) || treeShellEl.clientHeight || 0;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.position = "absolute";
  svg.style.left = "0";
  svg.style.top = "0";
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;
  svg.style.overflow = "visible";
  svg.style.pointerEvents = "none";
  ensureArrowMarkers(svg);

  for (const edge of state.edges) {
    const fromCell = state.cells.find(c => c.cell_id === edge.fromRef) || null;
    const toCell = state.cells.find(c => c.cell_id === edge.toRef) || null;
    if (!fromCell || !toCell) continue;

    const fromRect = state.rectMap.get(fromCell.cell_id);
    const toRect = state.rectMap.get(toCell.cell_id);
    if (!fromRect || !toRect) continue;

    const a = getRectAnchor(fromRect, "right");
    const b = getRectAnchor(toRect, "left");
    const active = state.selectedUnitId && (state.selectedUnitId === edge.fromId || state.selectedUnitId === edge.toId);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", makeCurvedPath(a, b));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");

    if (active) {
      path.setAttribute("stroke", "rgba(255, 221, 110, 0.96)");
      path.setAttribute("stroke-width", "3.4");
      path.setAttribute("opacity", "1");
      path.setAttribute("filter", "drop-shadow(0 0 4px rgba(255,221,110,0.65))");
      path.setAttribute("marker-end", "url(#arrowhead-gold)");
    } else {
      path.setAttribute("stroke", "rgba(125, 190, 255, 0.68)");
      path.setAttribute("stroke-width", "2.2");
      path.setAttribute("opacity", "0.95");
      path.setAttribute("stroke-dasharray", "7 8");
      path.setAttribute("marker-end", "url(#arrowhead-blue)");
    }

    svg.appendChild(path);
  }

  edgeLayerEl.appendChild(svg);
}

function renderSingleUnitPanel(member) {
  const row = member.registryRow || null;

  detailPanelEl.innerHTML = `
    <div class="hero-card">
      <div class="hero-image ${member.imageUrl ? "" : "placeholder"}">
        ${member.imageUrl ? `<img src="${escapeHTML(member.imageUrl)}" alt="${escapeHTML(member.displayName)}" />` : "No Image"}
      </div>
      <div class="hero-content">
        <div class="hero-kicker"><span class="tag ${member.type}">${member.type}</span></div>
        <h3 class="hero-name">${escapeHTML(member.displayName)}</h3>
        <div class="meta-grid">
          <div class="meta-box"><div class="meta-label">Unit ID</div><div class="meta-value">${escapeHTML(member.unitId || "—")}</div></div>
          <div class="meta-box"><div class="meta-label">Nation</div><div class="meta-value">${escapeHTML(row?.nation || "STILL_NOT_FOUND")}</div></div>
          <div class="meta-box"><div class="meta-label">WT Name</div><div class="meta-value">${escapeHTML(row?.wt_name || "—")}</div></div>
          <div class="meta-box"><div class="meta-label">Master Key</div><div class="meta-value">${escapeHTML(row?.master_key || member.unitId || "—")}</div></div>
        </div>
      </div>
    </div>
  `;
}

function renderGroupPanel(cell) {
  const summaryTags = [];
  for (const t of ["squadron", "event", "pack", "premium", "tech"]) {
    const n = cell.groupCounts[t] || 0;
    if (n > 0) summaryTags.push(`<span class="tag ${t}">${t} ${n}</span>`);
  }

  const listHtml = cell.members.map(member => `
    <div class="member-item" data-member-unit-id="${escapeHTML(member.unitId)}">
      <div class="member-thumb ${member.imageUrl ? "" : "placeholder"}">
        ${member.imageUrl ? `<img src="${escapeHTML(member.imageUrl)}" alt="${escapeHTML(member.displayName)}" />` : "No Image"}
      </div>
      <div>
        <div class="member-name">${escapeHTML(member.displayName)}</div>
        <div class="badge-row" style="margin-top:0;"><span class="tag ${member.type}">${member.type}</span></div>
        <div style="margin-top:6px;font-size:11px;color:var(--muted);">${escapeHTML(member.unitId)}</div>
      </div>
    </div>
  `).join("");

  detailPanelEl.innerHTML = `
    <div class="hero-card">
      <div class="hero-content">
        <div class="hero-kicker">${summaryTags.join(" ")}</div>
        <h3 class="hero-name">${escapeHTML(cell.displayTitle)}</h3>
        <div style="color:var(--muted);font-size:13px;line-height:1.5;">
          Grouped aircraft folder. Select a member below to inspect the exact aircraft record.
        </div>
        <div class="meta-grid" style="margin-top:16px;">
          <div class="meta-box"><div class="meta-label">Group Members</div><div class="meta-value">${cell.members.length}</div></div>
          <div class="meta-box"><div class="meta-label">Primary Unit</div><div class="meta-value">${escapeHTML(cell.primaryUnitId || "—")}</div></div>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-title"><span>Folder Members</span></div>
      <div class="member-list">${listHtml}</div>
    </div>
  `;

  detailPanelEl.querySelectorAll("[data-member-unit-id]").forEach(el => {
    el.addEventListener("click", () => {
      const unitId = el.getAttribute("data-member-unit-id");
      const member = cell.members.find(m => m.unitId === unitId);
      if (member) renderSingleUnitPanel(member);
    });
  });
}

function selectCell(cell) {
  state.selectedCellId = cell.cell_id;
  state.selectedUnitId = cell.primaryUnitId || "";

  document.querySelectorAll(".tree-cell.active").forEach(el => el.classList.remove("active"));
  const activeEl = document.querySelector(`.tree-cell[data-cell-id="${cssEscape(cell.cell_id)}"]`);
  if (activeEl) activeEl.classList.add("active");

  if (cell.isGroup) renderGroupPanel(cell);
  else renderSingleUnitPanel(cell.members[0]);

  renderEdges();
}

async function initiateSystem() {
  setStatus("Loading tree, flags, registry, and edge truth...");

  const [treePayload, flagsPayload, regText, edgeText] = await Promise.all([
    fetchJSON(TREE_JSON_URL),
    fetchJSON(FLAGS_JSON_URL),
    fetchText(REGISTRY_CSV_URL),
    fetchText(EDGES_CSV_URL)
  ]);

  const registryRows = parseCSV(regText);
  state.registryByKey = buildRegistryMap(registryRows);
  state.flagMap = buildFlagMap(flagsPayload);

  const rawCells = Array.isArray(treePayload.cells) ? treePayload.cells : [];
  const bad = rawCells.map(normalizeCell).filter(c => !validateCellPlacement(c));
  if (bad.length) {
    setStatus(`Some cells invalid.\nFirst bad cell:\n${JSON.stringify(bad[0], null, 2)}`, true);
  }

  state.cells = prepareCells(rawCells);
  if (!state.cells.length) {
    throw new Error(`No valid cells found. First raw cell: ${JSON.stringify(rawCells[0], null, 2)}`);
  }

  const cellsById = new Map();

  for (const cell of state.cells) {
    cellsById.set(cell.cell_id, cell);
    cellsById.set(normId(cell.cell_id), cell);
    cellsById.set(cell.cell_key, cell);
    cellsById.set(normId(cell.cell_key), cell);

    if (cell.primaryUnitId) {
      cellsById.set(cell.primaryUnitId, cell);
      cellsById.set(normId(cell.primaryUnitId), cell);
    }

    if (cell.displayTitle) {
      cellsById.set(cell.displayTitle, cell);
      cellsById.set(normId(cell.displayTitle), cell);
    }

    if (cell.master_key) {
      cellsById.set(cell.master_key, cell);
      cellsById.set(normId(cell.master_key), cell);
    }

    for (const id of cell.unitIds) {
      cellsById.set(id, cell);
      cellsById.set(normId(id), cell);
    }
  }

  const edgeRows = parseCSV(edgeText);
  const jsonEdges = Array.isArray(treePayload.edges)
    ? treePayload.edges
    : (Array.isArray(treePayload.arrows) ? treePayload.arrows : []);

  state.edges = buildVisibleEdges(edgeRows, null, cellsById);
  state.arrowSourceUsed = "csv";

  if (!state.edges.length && jsonEdges.length) {
    state.edges = buildVisibleEdges(jsonEdges, null, cellsById);
    state.arrowSourceUsed = "json-fallback";
  }

  const { rankLayout, width, height } = computeRankLayout(state.cells);
  treeShellEl.style.width = `${width}px`;
  treeShellEl.style.height = `${height}px`;

  renderRankBands(rankLayout, width);
  state.rectMap = renderCells(state.cells, rankLayout);
  renderEdges();

  const first = state.cells.find(c => !c.isGroup) || state.cells[0];
  if (first) selectCell(first);

  const counts = { tech: 0, premium: 0, squadron: 0, event: 0, pack: 0 };
  for (const cell of state.cells) {
    counts[cell.mainType] = (counts[cell.mainType] || 0) + 1;
  }

  setStatus(
`Loaded OK
Tree: ${TREE_JSON_URL}
Flags: ${FLAGS_JSON_URL}
Registry: ${REGISTRY_CSV_URL}
Edges: ${EDGES_CSV_URL}
Visible cells: ${state.cells.length}
Drawn arrows: ${state.edges.length}
Premium: ${counts.premium} | Squadron: ${counts.squadron} | Event: ${counts.event} | Pack: ${counts.pack}
Flag rows indexed: ${state.flagMap.size}
Arrow source used: ${state.arrowSourceUsed || "csv"}
Cell height scale: ${CELL_HEIGHT_SCALE}
Image scale: ${IMAGE_SCALE}`
  );
}

if (treeShellEl && rankLayerEl && edgeLayerEl && nodeLayerEl) {
  initiateSystem();
}
