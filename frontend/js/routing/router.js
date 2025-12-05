// frontend/js/routing/router.js

import MainPage      from "../pages/main.js";
import CategoryPage  from "../pages/category.js";
import DetailsPage   from "../pages/details.js";
import CartPage      from "../pages/cart.js";
import TelegramSDK   from "../telegram/telegram.js";

// ---------- Конфиг роутов ----------
const routes = {
  main:     { name: "main",     template: "/pages/main.html",     controller: new MainPage() },
  category: { name: "category", template: "/pages/category.html", controller: new CategoryPage() },
  details:  { name: "details",  template: "/pages/details.html",  controller: new DetailsPage() },
  cart:     { name: "cart",     template: "/pages/cart.html",     controller: new CartPage() },
};

// ---------- Кэш HTML ----------
const htmlCache = new Map();

// ---------- DOM-узлы ----------
const $root      = document.getElementById("content");
const $pageA     = document.getElementById("page-current");
const $pageB     = document.getElementById("page-next");

let isNavigating = false;
let current = { route: null, node: $pageA }; // какая страница сейчас показана

function rAF() { return new Promise(res => requestAnimationFrame(res)); }

// ---------- Загрузка HTML с кэшем ----------
async function getTemplate(url) {
  if (htmlCache.has(url)) return htmlCache.get(url);
  const resp = await fetch(url, { cache: "no-cache" });
  if (!resp.ok) throw new Error(`Failed to load template: ${url}`);
  const html = await resp.text();
  htmlCache.set(url, html);
  return html;
}

// ---------- Разбор хэша ----------
function parseHash() {
  // формат: #/route?key=value&...
  const hash = (location.hash || "").replace(/^#\/?/, "");
  const [rawRoute = "", rawQuery = ""] = hash.split("?");
  const route = (rawRoute || "main").toLowerCase();

  const params = {};
  new URLSearchParams(rawQuery).forEach((v, k) => { params[k] = v; });

  return { route, params };
}

// ---------- Переход ----------
export async function navigateTo(route, params = {}) {
  if (isNavigating) return;
  if (!routes[route]) route = "main";

  const qs = new URLSearchParams(params).toString();
  const hash = `#/${route}${qs ? "?" + qs : ""}`;
  if (location.hash === hash) {
    // форсим хэндл, если кто-то зовёт navigateTo тем же маршрутом
    return handleLocation();
  }
  location.hash = hash;
}

// ---------- Основной обработчик ----------
export async function handleLocation() {
  if (isNavigating) return;
  isNavigating = true;

  try {
    const { route: routeName, params } = parseHash();
    const conf = routes[routeName] || routes.main;

    // показать/скрыть кнопку "назад"
    try {
      TelegramSDK.setBackButtonVisible(routeName !== "main");
    } catch {}

    // 1) берём HTML и кладём в page-next
    const html = await getTemplate(conf.template);
    const nextNode = current.node === $pageA ? $pageB : $pageA;
    nextNode.innerHTML = html;
    nextNode.style.display = "";
    current.node.style.display = "none";

    // небольшая пауза кадра, чтобы DOM реально появился
    await rAF();

    // 2) теперь, когда DOM вставлен — вызываем load(params)
    //    ВАЖНО: раньше load() вызывался ДО вставки DOM — из-за этого «скелет» не менялся.
    if (conf.controller && typeof conf.controller.load === "function") {
      await conf.controller.load(params || {});
    }

    // 3) обновляем текущий указатель
    current = { route: conf, node: nextNode };
  } catch (e) {
    console.error("[Router] handleLocation error:", e);
  } finally {
    isNavigating = false;
  }
}

// ---------- Инициализация ----------
window.navigateTo = navigateTo;   // чтобы можно было звать из страниц
window.handleLocation = handleLocation;

window.addEventListener("hashchange", handleLocation);
window.addEventListener("load", handleLocation);