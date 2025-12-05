// frontend/js/routing/router.js

import MainPage     from "../pages/main.js";
import CategoryPage from "../pages/category.js";
import DetailsPage  from "../pages/details.js";
import CartPage     from "../pages/cart.js";
import TelegramSDK  from "../telegram/telegram.js";

// Регистрируем страницы
const routes = {
  main:     new MainPage(),
  category: new CategoryPage(),
  details:  new DetailsPage(),
  cart:     new CartPage(),
};

// Память для HTML шаблонов
const htmlCache = Object.create(null);

// Текущий ключ и флаг навигации
let currentKey = "";
let navigating = false;

// Универсально достаём путь к HTML из экземпляра страницы
function htmlPathOf(route) {
  return (
    route?.templatePath ||
    route?.path ||
    route?.template ||
    route?.templateURL ||
    route?.pagePath ||
    null
  );
}

// Парсим текущее назначение (поддерживаем и #/..., и старое ?dest=...)
function parseUrl() {
  // 1) hash (рекомендуемый формат): #/details?id=burger-1
  if (location.hash) {
    const raw = location.hash.replace(/^#\/?/, "");
    const [name, qs] = raw.split("?");
    const dest = (name || "main").trim();
    const params = Object.fromEntries(new URLSearchParams(qs || "").entries());
    return { dest, params };
  }
  // 2) legacy search: ?dest=details&id=burger-1
  const search = new URLSearchParams(location.search);
  const dest = (search.get("dest") || "main").trim();
  search.delete("dest");
  const params = Object.fromEntries(search.entries());
  return { dest, params };
}

async function getHtml(path) {
  if (!path) throw new Error("HTML path is undefined");
  if (htmlCache[path]) return htmlCache[path];
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`HTML load failed: ${path}`);
  const html = await r.text();
  htmlCache[path] = html;
  return html;
}

async function render(route, params) {
  const curr = document.getElementById("page-current");
  const next = document.getElementById("page-next");

  const html = await getHtml(htmlPathOf(route));
  next.innerHTML = html;

  next.style.display = "";
  curr.style.display = "none";

  if (typeof route.load === "function") {
    await route.load(params);
  }

  curr.innerHTML = next.innerHTML;
  curr.style.display = "";
  next.style.display = "none";
  next.innerHTML = "";
}

export async function handleLocation() {
  if (navigating) return;
  navigating = true;
  try {
    const { dest, params } = parseUrl();
    const name = routes[dest] ? dest : "main";
    const key = name + "?" + new URLSearchParams(params).toString();
    if (key === currentKey) return;

    await render(routes[name], params);
    currentKey = key;

    try { TelegramSDK.ready(); TelegramSDK.MainButton?.hideProgress?.(); } catch {}
  } catch (e) {
    console.error(e);
  } finally {
    navigating = false;
  }
}

export function navigateTo(dest, params = null) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const nextHash = "#/" + dest + qs;
  if (location.hash === nextHash) {
    handleLocation();
    return;
  }
  location.hash = nextHash; // триггерит hashchange → handleLocation
}

// Системные подписки
window.addEventListener("hashchange", handleLocation);

// Экспорт на всякий случай
window.navigateTo = navigateTo;
window.handleLocation = handleLocation;

export default { navigateTo, handleLocation };