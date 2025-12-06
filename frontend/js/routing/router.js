// frontend/js/routing/router.js
// Универсальный роутер: понимает и "#/main?p=..." и "#/?dest=main&params=..."
// Грузит HTML из /pages, затем вызывает page.load(params)

import MainPage     from "../pages/main.js";
import CategoryPage from "../pages/category.js";
import DetailsPage  from "../pages/details.js";
import CartPage     from "../pages/cart.js";
import TelegramSDK  from "../telegram/telegram.js";

// Регистр доступных маршрутов
const routes = {
  main:     new MainPage(),
  category: new CategoryPage(),
  details:  new DetailsPage(),
  cart:     new CartPage(),
};

// Определяем путь к HTML фрагменту
function htmlPathOf(route, name) {
  if (!route) return null;
  if (route.htmlPath) return route.htmlPath;       // если у страницы явно задан htmlPath
  if (route.html)     return route.html;           // или html
  if (typeof route.getHtmlPath === "function")     // или метод
    return route.getHtmlPath();
  return `/pages/${name}.html`;                    // дефолт по соглашению
}

// Кэш HTML
const htmlCache = Object.create(null);
async function getHtml(path) {
  if (!path) throw new Error("HTML path is undefined");
  if (htmlCache[path]) return htmlCache[path];
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`HTML load failed: ${path}`);
  const html = await r.text();
  htmlCache[path] = html;
  return html;
}

// Разбор хэша: поддерживаем два стиля
function parseHash() {
  const h = location.hash || "";

  // Стиль "#/dest?p=%7B...%7D"
  let m = h.match(/^#\/([^?]+)(?:\?(.*))?$/);
  if (m) {
    const dest = decodeURIComponent(m[1] || "main");
    const search = new URLSearchParams(m[2] || "");
    let params = search.get("p");
    if (params) { try { params = JSON.parse(decodeURIComponent(params)); } catch { params = null; } }
    else params = null;
    return { dest, params };
  }

  // Стиль "#/?dest=main&params=%7B...%7D"
  const q  = h.includes("?") ? h.substring(h.indexOf("?") + 1) : "";
  const sp = new URLSearchParams(q);
  const dest = sp.get("dest") || "main";
  let params = sp.get("params");
  if (params) { try { params = JSON.parse(decodeURIComponent(params)); } catch { params = null; } }
  else params = null;
  return { dest, params };
}

async function render(route, params, name) {
  const curr = document.getElementById("page-current");
  const next = document.getElementById("page-next");

  const html = await getHtml(htmlPathOf(route, name));
  next.innerHTML = html;

  next.style.display = "";
  curr.style.display = "none";

  // свап id
  curr.id = "page-next";
  next.id = "page-current";

  // на всякий случай гарантируем наличие page-next
  if (!document.getElementById("page-next")) {
    const frag = document.createElement("div");
    frag.id = "page-next";
    frag.className = "page";
    frag.style.display = "none";
    (document.getElementById("content") || document.body).appendChild(frag);
  }

  if (route && typeof route.load === "function") {
    await route.load(params || null);
  }
}

// Публичная навигация
export function navigateTo(dest, params = null) {
  let hash = `#/${encodeURIComponent(dest)}`;
  if (params) {
    try { hash += `?p=${encodeURIComponent(JSON.stringify(params))}`; } catch {}
  }
  if (location.hash === hash) handleLocation();
  else location.hash = hash;
}

export async function handleLocation() {
  try {
    const { dest, params } = parseHash();
    const name  = dest || "main";
    const route = routes[name];

    if (!route) {
      console.error("[Router] Route not found, fallback to main. dest=", name, "available=", Object.keys(routes));
      return navigateTo("main");
    }

    // Телеграм обвязка
    TelegramSDK.ready();
    TelegramSDK.expand();
    TelegramSDK.hideMainButton();
    TelegramSDK.hideSecondaryButton();

    await render(route, params, name);
  } catch (e) {
    console.error("[Router] handleLocation error:", e);
  }
}

// Инициализация роутера
export function bootRouter() {
  if (!location.hash || location.hash === "#/" || location.hash === "#") {
    navigateTo("main");
  } else {
    handleLocation();
  }
}

// На окно — для удобства отладки
window.navigateTo = navigateTo;
window.handleLocation = handleLocation;
window.bootRouter   = bootRouter;

export default { navigateTo, handleLocation, bootRouter };