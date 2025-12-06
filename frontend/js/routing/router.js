// frontend/js/routing/router.js
import MainPage     from "../pages/main.js";
import CategoryPage from "../pages/category.js";
import DetailsPage  from "../pages/details.js";
import CartPage     from "../pages/cart.js";

// Список страниц. Важно: в конструкторах страниц должны быть корректные name и htmlPath:
//   super("main", "/pages/main.html")
//   super("category", "/pages/category.html")
//   super("details", "/pages/details.html")
//   super("cart", "/pages/cart.html")
const routes = [
  new MainPage(),
  new CategoryPage(),
  new DetailsPage(),
  new CartPage(),
];

const routesByName = new Map(routes.map(r => [r.name, r]));
let currentRoute = null;

function parseHash() {
  const raw = location.hash || "";
  const q = raw.startsWith("#") ? raw.slice(1) : raw; // "?dest=...&params=..."
  const sp = new URLSearchParams(q);

  const dest = sp.get("dest") || "main";
  let params = null;

  const p = sp.get("params");
  if (p) {
    try {
      params = JSON.parse(p);
    } catch (e) {
      console.warn("[Router] bad params JSON, ignored:", p, e);
    }
  }
  return { dest, params };
}

export function navigateTo(dest, params) {
  const sp = new URLSearchParams();
  sp.set("dest", dest);
  if (params != null) sp.set("params", JSON.stringify(params));
  location.hash = `?${sp.toString()}`;
}

async function fetchHtml(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTML load failed: ${path} (${res.status})`);
  return await res.text();
}

export async function handleLocation() {
  try {
    // если первый запуск без hash — уйдём на main
    if (!location.hash) {
      navigateTo("main");
      return;
    }

    const { dest, params } = parseHash();
    const route = routesByName.get(dest) || routesByName.get("main");

    if (!route) throw new Error(`Route not found (dest="${dest}")`);
    if (!route.htmlPath) throw new Error(`Route "${route.name}" has no htmlPath`);

    const container =
      document.getElementById("page-current") ||
      document.getElementById("content") ||
      document.body;

    const html = await fetchHtml(route.htmlPath);
    container.innerHTML = html;

    currentRoute = route;
    if (typeof route.load === "function") {
      await route.load(params);
    }
  } catch (err) {
    console.error("[Router] handleLocation error:", err);
  }
}

// реагируем на смену hash
window.addEventListener("hashchange", handleLocation);

// экспорт по умолчанию — удобно, если где-то импортом по умолчанию тянут
export default { navigateTo, handleLocation };