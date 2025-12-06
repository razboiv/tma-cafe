// frontend/js/routing/router.js
import MainPage from "../pages/main.js";
import CategoryPage from "../pages/category.js";
import DetailsPage from "../pages/details.js";
import CartPage from "../pages/cart.js";

const routes = {
  main: new MainPage(),
  category: new CategoryPage(),
  details: new DetailsPage(),
  cart: new CartPage(),
};

function parseHash(hash) {
  let dest = "main";
  let params = null;

  if (hash && hash.startsWith("#/")) {
    const [path, query] = hash.slice(2).split("?");
    dest = path || "main";
    if (query && query.startsWith("p=")) {
      const raw = query.slice(2);
      try { params = JSON.parse(decodeURIComponent(raw)); }
      catch { params = null; }
    }
  }
  return { dest, params };
}

export function navigateTo(dest, params = null, replace = false) {
  const q = params ? `?p=${encodeURIComponent(JSON.stringify(params))}` : "";
  const next = `#/${dest}${q}`;
  if (replace) window.location.replace(next);
  else window.location.hash = next;
}

export async function handleLocation() {
  const { dest, params } = parseHash(window.location.hash);
  const route = routes[dest] || routes.main;

  try {
    const container = document.getElementById("page-current");
    if (!container) throw new Error("No #page-current container");
    const res = await fetch(route.templatePath, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTML load failed: ${route.templatePath}`);
    container.innerHTML = await res.text();
    await route.load(params || null);
  } catch (e) {
    console.error("[Router] handleLocation error:", e);
  }
}

window.addEventListener("hashchange", handleLocation);
window.navigateTo = navigateTo;
window.handleLocation = handleLocation;

export default { navigateTo, handleLocation };