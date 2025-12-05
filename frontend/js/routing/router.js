// Лёгкий роутер c кэшом HTML и ленивыми import()

const pageSel = {
  cur: "#page-current",
  next: "#page-next",
};

const cache = {};
let current = "main";

export function navigateTo(dest, params = null) {
  const url = new URL(location.href);
  url.hash = "";
  url.search = "";
  url.searchParams.set("dest", dest);
  if (params) url.searchParams.set("params", encodeURIComponent(JSON.stringify(params)));
  history.pushState({}, "", url.toString());
  handleLocation();
}

export function handleLocation() {
  const url = new URL(location.href);
  const dest = url.searchParams.get("dest") || "main";
  const params = url.searchParams.get("params");
  const parsedParams = params ? JSON.parse(decodeURIComponent(params)) : null;
  loadPage(dest, parsedParams);
}

window.addEventListener("popstate", handleLocation);

async function loadPage(dest, params) {
  if (dest === current && !params) return;

  const nextEl = document.querySelector(pageSel.next);
  nextEl.innerHTML = await render(dest, params);

  // простое переключение страниц (без анимаций, чтобы исключить «чёрные экраны»)
  const curEl = document.querySelector(pageSel.cur);
  curEl.style.display = "none";
  nextEl.style.display = "";
  curEl.innerHTML = nextEl.innerHTML;
  nextEl.innerHTML = "";
  nextEl.style.display = "none";
  curEl.style.display = "";

  current = dest;
}

async function render(dest, params) {
  const key = JSON.stringify({ dest, params });
  if (cache[key]) return cache[key];

  let mod;
  if (dest === "main") {
    mod = await import("../pages/main.js?v=1");
  } else if (dest === "category") {
    mod = await import("../pages/category.js?v=1");
  } else if (dest === "details") {
    mod = await import("../pages/details.js?v=1");
  } else if (dest === "cart") {
    mod = await import("../pages/cart.js?v=1");
  } else {
    return `<div style="padding:16px">Unknown route: ${dest}</div>`;
  }

  const html = await mod.default(params || {});
  cache[key] = html;
  return html;
}