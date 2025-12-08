// frontend/js/routing/router.js
// Надёжный роутер с ленивыми импортами и встроенными путями к HTML.
// Поддерживает хэши вида: "#/main?p=..." и "#/?dest=main&params=...".

import TelegramSDK from "../telegram/telegram.js";

console.log("[ROUTER] v11 loaded");

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
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`HTML load failed: ${path}`);
  const t = await r.text();
  htmlCache[path] = t;
  return t;
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

// Универсальная загрузка класса страницы из модуля
async function loadPageCtor(modulePath) {
  // cache-buster, чтобы гарантированно подхватывать свежую версию модулей
  const sep = modulePath.includes("?") ? "&" : "?";
  const url = `${modulePath}${sep}v=${Date.now()}`;

  const mod = await import(url);

  // 1) named export Page
  let Ctor = mod.Page;
  // 2) default export
  if (typeof Ctor !== "function") Ctor = mod.default;
  // 3) запасной вариант — любая экспортированная функция/класс
  if (typeof Ctor !== "function") {
    const anyFn = Object.values(mod).find(v => typeof v === "function");
    if (typeof anyFn === "function") Ctor = anyFn;
  }

  if (typeof Ctor !== "function") {
    console.error("[Router] Bad page module exports:", mod);
    throw new TypeError("Page is not a constructor");
  }
  return Ctor;
}

// Ленивая инициализация класса страницы
async function ensureInstance(name) {
  const meta = ROUTES[name];
  if (!meta) return null;
  if (meta.inst) return meta.inst;

  const PageCtor = await loadPageCtor(meta.module);
  meta.inst = new PageCtor();
  return meta.inst;
}

// Рендер: свапаем page-current <-> page-next
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

  // убедимся, что page-next снова есть
  if (!document.getElementById("page-next")) {
    const d = document.createElement("div");
    d.id = "page-next";
    d.className = "page";
    d.style.display = "none";
    (document.getElementById("content") || document.body).appendChild(d);
  }

  const page = await ensureInstance(name);
  if (page?.load) await page.load(params || null);
}

// Переход
export function navigateTo(dest, params = null) {
  let hash = `#/${encodeURIComponent(dest)}`;
  if (params) {
    try { hash += `?p=${encodeURIComponent(JSON.stringify(params))}`; } catch {}
  }
  if (location.hash === hash) handleLocation();
  else location.hash = hash;
}

// Обработчик
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

// Для отладки
window.navigateTo = navigateTo;
window.handleLocation = handleLocation;
window.bootRouter   = bootRouter;

export default { navigateTo, handleLocation, bootRouter };