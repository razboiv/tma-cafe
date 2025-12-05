// frontend/js/routing/router.js

import MainPage      from "../pages/main.js";
import CategoryPage  from "../pages/category.js";
import DetailsPage   from "../pages/details.js";
import CartPage      from "../pages/cart.js";
import TelegramSDK   from "../telegram/telegram.js";

const routes = {
  "":        new MainPage(),       // root
  "main":    new MainPage(),
  "category":new CategoryPage(),
  "details": new DetailsPage(),
  "cart":    new CartPage(),
};

// ===== in-memory HTML cache
const htmlCache = Object.create(null);

// ===== state
let navigating = false;
let currentKey = "";

function parseHash() {
  // Формат: #/details?id=burger-1&foo=bar
  const raw = (location.hash || "").replace(/^#\/?/, "");
  const [namePart, queryPart] = raw.split("?");
  const dest = (namePart || "main").trim();
  const params = Object.fromEntries(new URLSearchParams(queryPart || "").entries());
  return { dest, params };
}

async function getHtml(path) {
  if (htmlCache[path]) return htmlCache[path];
  const resp = await fetch(path, { cache: "no-cache" });
  if (!resp.ok) throw new Error(`HTML load failed: ${path}`);
  const html = await resp.text();
  htmlCache[path] = html;
  return html;
}

async function render(route, params) {
  // простая смена содержимого без сложных анимаций
  const next = document.getElementById("page-next");
  const curr = document.getElementById("page-current");
  const html = await getHtml(route.templatePath);
  next.innerHTML = html;

  // показать next, спрятать curr
  next.style.display  = "";
  curr.style.display  = "none";

  // вызвать загрузку страницы
  await route.load?.(params);

  // сделать next текущей
  curr.innerHTML      = next.innerHTML;
  curr.style.display  = "";
  next.style.display  = "none";
  next.innerHTML      = "";
}

export async function handleLocation() {
  if (navigating) return; // защита от гонок
  navigating = true;

  try {
    const { dest, params } = parseHash();
    const key = dest + "?" + new URLSearchParams(params).toString();
    if (key === currentKey) {
      navigating = false;
      return;
    }

    const route = routes[dest] || routes["main"];
    await render(route, params);

    currentKey = key;

    // сообщим Telegram’у о готовности и снимем случайные прогресс-кнопки
    try { TelegramSDK.ready(); TelegramSDK.MainButton?.hideProgress?.(); } catch {}
  } catch (e) {
    console.error(e);
  } finally {
    navigating = false;
  }
}

export function navigateTo(dest, params = null) {
  // ВАЖНО: только hash, НИКАКОГО pushState/`?dest=...`!
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const nextHash = "#/" + dest + qs;
  if (location.hash === nextHash) {
    // если уже там — просто перерендерим на всякий случай
    handleLocation();
    return;
  }
  location.hash = nextHash; // триггерит hashchange → handleLocation
}

// Системные подписки
window.addEventListener("hashchange", handleLocation);

// Экспорт в глобал (чтобы можно было вызвать из разметки, если где-то используешь)
window.navigateTo    = navigateTo;
window.handleLocation= handleLocation;

export default { navigateTo, handleLocation };