// frontend/js/routing/router.js
import TelegramSDK from "../telegram/telegram.js";

console.log("[ROUTER] v12 loaded");

// Карта маршрутов (пути проверь: они должны соответствовать твоей структуре)
const ROUTES = {
  main:     { html: "pages/main.html",     module: "../pages/main.js",     inst: null },
  category: { html: "pages/category.html", module: "../pages/category.js", inst: null },
  details:  { html: "pages/details.html",  module: "../pages/details.js",  inst: null },
  cart:     { html: "pages/cart.html",     module: "../pages/cart.js",     inst: null },
};

// --- HTML cache -------------------------------------------------------------
const htmlCache = Object.create(null);
async function getHtml(path) {
  if (!path) throw new Error("HTML path is undefined");
  if (htmlCache[path]) return htmlCache[path];
  const resp = await fetch(path, { cache: "no-cache" });
  if (!resp.ok) throw new Error(`HTML load failed: ${path}`);
  const text = await resp.text();
  htmlCache[path] = text;
  return text;
}

// --- Hash parsing -----------------------------------------------------------
function parseHash() {
  const h = location.hash || "";

  let m = h.match(/^#\/([^?]+)(?:\?(.*))?$/);        // "#/dest?..."
  if (m) {
    const dest = decodeURIComponent(m[1] || "main");
    const sp = new URLSearchParams(m[2] || "");
    let p = sp.get("p");
    if (p) { try { p = JSON.parse(decodeURIComponent(p)); } catch { p = null; } }
    else p = null;
    return { dest, params: p };
  }

  // "#/?dest=...&params=..."
  const q = h.includes("?") ? h.slice(h.indexOf("?") + 1) : "";
  const sp = new URLSearchParams(q);
  const dest = sp.get("dest") || "main";
  let p = sp.get("params");
  if (p) { try { p = JSON.parse(decodeURIComponent(p)); } catch { p = null; } }
  else p = null;
  return { dest, params: p };
}

// --- Универсальная загрузка инстанса страницы ------------------------------
async function loadPageInstance(modulePath) {
  const sep = modulePath.includes("?") ? "&" : "?";
  const url = `${modulePath}${sep}v=${Date.now()}`;  // cache-buster

  const mod = await import(url);

  // 1) Класс Page (named)
  if (typeof mod.Page === "function") {
    try { return new mod.Page(); } catch {}
  }
  // 2) Класс по default
  if (typeof mod.default === "function") {
    try { return new mod.default(); } catch {}
  }
  // 3) Фабрика createPage()
  if (typeof mod.createPage === "function") {
    try {
      const inst = mod.createPage();
      if (inst && typeof inst.load === "function") return inst;
    } catch {}
  }
  // 4) Объект с load()
  if (mod.default && typeof mod.default.load === "function") {
    return mod.default;
  }
  if (typeof mod.load === "function") {
    return { load: mod.load };
  }
  // 5) Любая экспортированная функция/класс с прототипом load
  const anyFn = Object.values(mod).find(v => typeof v === "function");
  if (anyFn) {
    try {
      const cand = new anyFn();
      if (cand && typeof cand.load === "function") return cand;
    } catch {}
  }

  console.warn("[Router] Could not resolve Page from module, using Noop:", mod);
  return { async load() {} }; // безопасный заглушечный инстанс
}

// --- Ленивая инициализация --------------------------------------------------
async function ensureInstance(name) {
  const meta = ROUTES[name];
  if (!meta) return null;
  if (meta.inst) return meta.inst;
  meta.inst = await loadPageInstance(meta.module);
  return meta.inst;
}

// --- Рендер -----------------------------------------------------------------
async function render(name, params) {
  const meta = ROUTES[name];
  if (!meta) throw new Error(`Route meta not found: ${name}`);

  const curr = document.getElementById("page-current");
  const next = document.getElementById("page-next");

  const html = await getHtml(meta.html);
  next.innerHTML = html;

  next.style.display = "";
  curr.style.display = "none";

  // swap id
  curr.id = "page-next";
  next.id = "page-current";

  // восстановить page-next, если исчез
  if (!document.getElementById("page-next")) {
    const d = document.createElement("div");
    d.id = "page-next";
    d.className = "page";
    d.style.display = "none";
    (document.getElementById("content") || document.body).appendChild(d);
  }

  const page = await ensureInstance(name);
  if (page && typeof page.load === "function") {
    await page.load(params || null);
  }
}

// --- Навигация --------------------------------------------------------------
export function navigateTo(dest, params = null) {
  let hash = `#/${encodeURIComponent(dest)}`;
  if (params) {
    try { hash += `?p=${encodeURIComponent(JSON.stringify(params))}`; } catch {}
  }
  if (location.hash === hash) handleLocation();
  else location.hash = hash;
}

// --- Обработчик переходов ---------------------------------------------------
export async function handleLocation() {
  try {
    const { dest, params } = parseHash();
    const name = dest || "main";

    if (!ROUTES[name]) {
      console.warn("[Router] Unknown route → fallback main:", name);
      return navigateTo("main");
    }

    TelegramSDK.ready?.();
    TelegramSDK.expand?.();
    TelegramSDK.hideMainButton?.();
    TelegramSDK.hideSecondaryButton?.();

    await render(name, params);
  } catch (e) {
    console.error("[Router] handleLocation error:", e);
  }
}

// --- Старт ------------------------------------------------------------------
export function bootRouter() {
  if (!location.hash || location.hash === "#/" || location.hash === "#") {
    navigateTo("main");
  } else {
    handleLocation();
  }
}

window.navigateTo = navigateTo;
window.handleLocation = handleLocation;
window.bootRouter   = bootRouter;

export default { navigateTo, handleLocation, bootRouter };