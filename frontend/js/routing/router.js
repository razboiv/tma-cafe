// frontend/js/routing/router.js
import Route from "./route.js";
import MainPage from "../pages/main.js";
import CategoryPage from "../pages/category.js";
import DetailsPage from "../pages/details.js";
import CartPage from "../pages/cart.js";

const routes = [
  new MainPage(),
  new CategoryPage(),
  new DetailsPage(),
  new CartPage(),
];

window.__routes = routes; // для быстрой диагностики в консоли

const htmlCache = new Map();

function qs(s) {
  if (!s) return new URLSearchParams();
  return s.startsWith("?") || s.startsWith("#")
    ? new URLSearchParams(s.slice(1))
    : new URLSearchParams(s);
}

function getUrlState() {
  const search = qs(location.search);
  const hash = qs(location.hash);
  const dest = search.get("dest") || hash.get("dest") || "main";
  const rawParams = search.get("params") || hash.get("params");
  let params = null;
  if (rawParams) {
    try { params = JSON.parse(decodeURIComponent(rawParams)); } catch { params = null; }
  }
  return { dest, params };
}

function findRoute(name) {
  return routes.find(r => r.name === name) || routes.find(r => r.name === "main");
}

async function getHtml(route) {
  const html = await route.fetchHtml();   // весь контроль пути внутри Route
  return htmlCache.get(route.htmlPath) || (htmlCache.set(route.htmlPath, html), html);
}

function getContainers() {
  const content = document.getElementById("content");
  let current = document.getElementById("page-current");
  let next = document.getElementById("page-next");
  if (!content) throw new Error("#content not found in index.html");
  if (!current || !next) {
    current = document.createElement("div");
    next = document.createElement("div");
    current.id = "page-current";
    next.id = "page-next";
    current.className = next.className = "page";
    next.style.display = "none";
    content.innerHTML = "";
    content.appendChild(current);
    content.appendChild(next);
  }
  return { current, next };
}

export async function navigateTo(dest, params) {
  const encoded = params ? encodeURIComponent(JSON.stringify(params)) : "";
  const q = `?dest=${encodeURIComponent(dest)}${encoded ? `&params=${encoded}` : ""}`;
  history.pushState(null, "", q + `#dest=${encodeURIComponent(dest)}${encoded ? `&params=${encoded}` : ""}`);
  await handleLocation();
}

export async function handleLocation() {
  const { current, next } = getContainers();
  const { dest, params } = getUrlState();
  const route = findRoute(dest);

  try {
    const html = await getHtml(route);
    next.innerHTML = html;
    next.style.display = "block";

    await route.beforeEnter?.(params);

    // простой swap (без сложных анимаций)
    const tmpId = current.id;
    current.style.display = "none";
    current.id = next.id;
    next.id = tmpId;

    document.getElementById("page-current"); // актуальный контейнер
    await route.load?.(params);
    await route.afterEnter?.(params);
  } catch (e) {
    console.error("[Router] handleLocation error:", e);
  }
}

window.addEventListener("popstate", handleLocation);

export function bootRouter() {
  getContainers();
  return handleLocation();
}