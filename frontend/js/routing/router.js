// frontend/js/routing/router.js
import TelegramSDK from "../telegram/telegram.js";

console.log("[ROUTER] v13 loaded");

// Карта маршрутов
const ROUTES = {
  main:     { html: "pages/main.html",     module: "../pages/main.js",     inst: null },
  category: { html: "pages/category.html", module: "../pages/category.js", inst: null },
  details:  { html: "pages/details.html",  module: "../pages/details.js",  inst: null },
  cart:     { html: "pages/cart.html",     module: "../pages/cart.js",     inst: null },
};

// Кэш HTML
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

// Разбор hash
function parseHash() {
  const h = location.hash || "";

  // "#/dest?..."
  let m = h.match(/^#\/([^?]+)(?:\?(.*))?$/);
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

// Универсальная загрузка инстанса страницы
async function loadPageInstance(modulePath) {
  const sep = modulePath.includes("?") ? "&" : "?";
  const url = `${modulePath}${sep}v=${Date.now()}`; // cache-buster

  const mod = await import(url);

  // Собираем все потенциальные кандидаты
  const candPool = new Set();

  function pushIf(v) { if (v != null) candPool.add(v); }

  pushIf(mod.Page);
  pushIf(mod.default);
  pushIf(mod.createPage);

  // все named-экспорты
  Object.values(mod).forEach(pushIf);
  // вложенные внутри default
  if (mod.default && typeof mod.default === "object") {
    Object.values(mod.default).forEach(pushIf);
  }

  // Функция проверки/создания инстанса
  const tryMake = (x) => {
    // объект с load()
    if (x && typeof x === "object" && typeof x.load === "function") return x;

    // класс/функция с прототипом load()
    if (typeof x === "function") {
      // 1) если прототип уже содержит load — это то, что надо
      if (x.prototype && typeof x.prototype.load === "function") {
        try { return new x(); } catch {}
      }
      // 2) фабрика — попробуем вызвать без аргументов
      try {
        const r = x();
        if (r && typeof r.load === "function") return r;
      } catch {}
    }
    return null;
  };

  // Приоритет: Page, default, всё остальное
  const ordered = [];
  if (mod.Page) ordered.push(mod.Page);
  if (mod.default) ordered.push(mod.default);
  candPool.forEach(v => { if (!ordered.includes(v)) ordered.push(v); });

  for (const c of ordered) {
    const inst = tryMake(c);
    if (inst) return inst;
  }

  console.warn("[Router] Could not resolve Page from module, using Noop:", mod);
  return { async load() {} }; // безопасная заглушка
}

// Ленивая инициализация
async function ensureInstance(name) {
  const meta = ROUTES[name];
  if (!meta) return null;
  if (meta.inst) return meta.inst;
  meta.inst = await loadPageInstance(meta.module);
  return meta.inst;
}

// Рендер
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

  // восстановить page-next, если вдруг пропал
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

// Навигация
export function navigateTo(dest, params = null) {
  let hash = `#/${encodeURIComponent(dest)}`;
  if (params) {
    try { hash += `?p=${encodeURIComponent(JSON.stringify(params))}`; } catch {}
  }
  if (location.hash === hash) handleLocation();
  else location.hash = hash;
}

// Обработчик переходов
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

// Старт
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