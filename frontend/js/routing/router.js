// frontend/js/routing/router.js
// Простой надёжный роутер для TMA: понимает оба формата хэша,
// сам знает пути к HTML, лениво импортирует JS-страницы.

import TelegramSDK from "../telegram/telegram.js";

// Карта доступных маршрутов: HTML путь + ленивый импорт JS
const ROUTES = {
  main:     { html: "/pages/main.html",     js: () => import("../pages/main.js"),     inst: null },
  category: { html: "/pages/category.html", js: () => import("../pages/category.js"), inst: null },
  details:  { html: "/pages/details.html",  js: () => import("../pages/details.js"),  inst: null },
  cart:     { html: "/pages/cart.html",     js: () => import("../pages/cart.js"),     inst: null },
};

// Простой кэш HTML
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

// Разбор #hash — поддерживаем:
// 1) "#/main?p=%7B...%7D"
// 2) "#/?dest=main&params=%7B...%7D"
function parseHash() {
  const h = location.hash || "";

  // стиль "#/dest?..."
  let m = h.match(/^#\/([^?]+)(?:\?(.*))?$/);
  if (m) {
    const dest = decodeURIComponent(m[1] || "main");
    const sp = new URLSearchParams(m[2] || "");
    let p = sp.get("p");
    if (p) { try { p = JSON.parse(decodeURIComponent(p)); } catch { p = null; } }
    else p = null;
    return { dest, params: p };
  }

  // стиль "#/?dest=...&params=..."
  const q = h.includes("?") ? h.slice(h.indexOf("?") + 1) : "";
  const sp = new URLSearchParams(q);
  const dest = sp.get("dest") || "main";
  let p = sp.get("params");
  if (p) { try { p = JSON.parse(decodeURIComponent(p)); } catch { p = null; } }
  else p = null;
  return { dest, params: p };
}

// Ленивая инициализация страницы
async function ensureInstance(name) {
  const meta = ROUTES[name];
  if (!meta) return null;
  if (meta.inst) return meta.inst;
  // default-экспорт класса страницы
  const mod = await meta.js();
  const Page = mod.default || mod[name];
  meta.inst = new Page();
  return meta.inst;
}

// Рендер страницы: меняем page-current <-> page-next
async function render(name, params) {
  const meta = ROUTES[name];
  if (!meta) throw new Error(`Route meta not found: ${name}`);

  const curr = document.getElementById("page-current");
  const next = document.getElementById("page-next");

  const html = await getHtml(meta.html);
  next.innerHTML = html;

  next.style.display = "";
  curr.style.display = "none";

  // свап id
  curr.id = "page-next";
  next.id = "page-current";

  // гарантия наличия page-next
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

// Публичный переход
export function navigateTo(dest, params = null) {
  let hash = `#/${encodeURIComponent(dest)}`;
  if (params) {
    try { hash += `?p=${encodeURIComponent(JSON.stringify(params))}`; } catch {}
  }
  if (location.hash === hash) handleLocation();
  else location.hash = hash;
}

// Основной обработчик
export async function handleLocation() {
  try {
    const { dest, params } = parseHash();
    const name = dest || "main";

    if (!ROUTES[name]) {
      console.warn("[Router] Unknown route, fallback → main:", name);
      return navigateTo("main");
    }

    TelegramSDK.ready();
    TelegramSDK.expand();
    TelegramSDK.hideMainButton();
    TelegramSDK.hideSecondaryButton();

    await render(name, params);
  } catch (e) {
    console.error("[Router] handleLocation error:", e);
  }
}

// Инициализация на старте
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