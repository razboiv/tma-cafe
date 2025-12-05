// frontend/js/routing/router.js

import MainPage     from "../pages/main.js";
import CategoryPage from "../pages/category.js";
import DetailsPage  from "../pages/details.js";
import CartPage     from "../pages/cart.js";
import TelegramSDK  from "../telegram/telegram.js";

// Регистрируем маршруты
const routes = {
  main:     new MainPage(),
  category: new CategoryPage(),
  details:  new DetailsPage(),
  cart:     new CartPage(),
};

// Кэш HTML
const htmlCache = Object.create(null);

let currentKey = "";
let navigating = false;

// Берём путь к HTML. Если ни одно поле не задано — используем /pages/<name>.html
function htmlPathOf(route, name) {
  return (
    route?.templatePath ||
    route?.path ||
    route?.template ||
    route?.templateURL ||
    route?.pagePath ||
    `/pages/${name}.html`
  );
}

// Разбор URL: поддерживаем #/route?x=1 и старый формат ?dest=route&x=1
function parseUrl() {
  if (location.hash) {
    const raw = location.hash.replace(/^#\/?/, "");
    const [name, qs] = raw.split("?");
    const dest = (name || "main").trim();
    const params = Object.fromEntries(new URLSearchParams(qs || "").entries());
    return { dest, params };
  }
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

async function render(route, params, name) {
  const curr = document.getElementById("page-current");
  const next = document.getElementById("page-next");

  // 1) Вставляем полученный HTML во временный контейнер
  const html = await getHtml(htmlPathOf(route, name));
  next.innerHTML = html;

  // 2) Переносим узлы из next в curr (перемещаем, а не копируем)
  //    так сохраняются все уже навешанные обработчики
  curr.replaceChildren(...Array.from(next.childNodes));
  next.innerHTML = "";

  // 3) Запускаем логику страницы уже над итоговым DOM
  if (typeof route.load === "function") {
    await route.load(params);
  }
}

export async function handleLocation() {
  if (navigating) return;
  navigating = true;
  try {
    const { dest, params } = parseUrl();
    const name = routes[dest] ? dest : "main";
    const key = name + "?" + new URLSearchParams(params).toString();
    if (key === currentKey) return;

    await render(routes[name], params, name);
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
  location.hash = nextHash; // вызовет hashchange → handleLocation
}

window.addEventListener("hashchange", handleLocation);

// Экспортим и на window (удобно в консоли)
window.navigateTo = navigateTo;
window.handleLocation = handleLocation;

export default { navigateTo, handleLocation };