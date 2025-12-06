// frontend/js/routing/router.js

import MainPage    from "../pages/main.js";
import CategoryPage from "../pages/category.js";
import DetailsPage  from "../pages/details.js";
import CartPage     from "../pages/cart.js";
import TelegramSDK  from "../telegram/telegram.js";

const routes = [
  new MainPage(),
  new CategoryPage(),
  new DetailsPage(),
  new CartPage(),
];

// Утилита: безопасно парсим params из URL
function parseParams(raw) {
  if (!raw) return null;
  try {
    const dec = decodeURIComponent(raw);
    // Если это похоже на JSON — парсим
    if (/^[\[{]/.test(dec)) return JSON.parse(dec);
    return dec;
  } catch {
    return raw;
  }
}

export function navigateTo(dest, params) {
  const url = new URL(window.location.href);
  url.searchParams.set("dest", dest);
  if (params !== undefined && params !== null) {
    const val = typeof params === "string" ? params : JSON.stringify(params);
    url.searchParams.set("params", val);
  } else {
    url.searchParams.delete("params");
  }
  history.pushState({}, "", url);
  return handleLocation();
}

export async function handleLocation() {
  const url = new URL(window.location.href);
  const dest = url.searchParams.get("dest") || "main";
  const params = parseParams(url.searchParams.get("params"));

  const route = routes.find(r => r?.name === dest);
  if (!route) {
    console.error(`[Router] route "${dest}" not found → fallback to "main"`);
    url.searchParams.set("dest", "main");
    history.replaceState({}, "", url);
    return handleLocation();
  }

  // подстрахуемся на любые имена поля-шаблона
  const htmlPath = route.htmlPath || route.html || route.templateUrl || route.template;
  if (!htmlPath) {
    console.error(`[Router] HTML path is undefined for route "${dest}"`);
    throw new Error("HTML load failed: undefined");
  }

  try {
    const res = await fetch(htmlPath, { cache: "no-cache" });
    if (!res.ok) throw new Error(`fetch ${htmlPath} -> ${res.status}`);
    const html = await res.text();

    const host = document.getElementById("page-current");
    if (!host) throw new Error("#page-current not found");
    host.innerHTML = html;

    // загрузка страницы
    if (typeof route.load === "function") {
      await route.load(params);
    }

    TelegramSDK.expand();
  } catch (e) {
    console.error("[Router] handleLocation error:", e);
    const host = document.getElementById("page-current");
    if (host) {
      host.innerHTML = `<div style="padding:24px;color:#fff">
        Failed to load page.<br>${e?.message || e}
      </div>`;
    }
  }
}

// навигация по кнопке «назад» браузера
window.addEventListener("popstate", handleLocation);