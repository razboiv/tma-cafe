// frontend/js/routing/router.js
import Route from "./route.js";

// Загружаем модули страниц (может быть default или именованный экспорт)
import * as MainMod     from "../pages/main.js";
import * as CategoryMod from "../pages/category.js";
import * as DetailsMod  from "../pages/details.js";
import * as CartMod     from "../pages/cart.js";

// Берём класс страницы из модуля (default, MainPage/CategoryPage/... или Page)
function pickPage(mod, fallbackName) {
  return mod?.default || mod?.[fallbackName] || mod?.Page || null;
}
function newPage(mod, name) {
  const Ctor = pickPage(mod, name);
  if (!Ctor) throw new Error(`[ROUTER] Cannot resolve page class from module (${name}).`);
  return new Ctor();
}

// Пути к HTML-шаблонам страниц
const routePaths = new Map([
  ["main",     "/frontend/pages/main.html"],
  ["category", "/frontend/pages/category.html"],
  ["details",  "/frontend/pages/details.html"],
  ["cart",     "/frontend/pages/cart.html"],
]);

// Алиасы маршрутов (на случай, если прилетает route=root)
const ROUTE_ALIASES = new Map([
  ["root",  "main"],
  ["home",  "main"],
  ["index", "main"],
]);

function normalizeRoute(name) {
  const r = (name || "main").trim();
  return ROUTE_ALIASES.get(r) || r;
}

class Router {
  constructor() {
    this.pages = {
      main:     newPage(MainMod,     "MainPage"),
      category: newPage(CategoryMod, "CategoryPage"),
      details:  newPage(DetailsMod,  "DetailsPage"),
      cart:     newPage(CartMod,     "CartPage"),
    };

    this.$current = $("#page-current");
    this.$next    = $("#page-next");

    // обрабатываем аппаратную кнопку «Назад» и history
    window.addEventListener("popstate", () => {
      const { route, params } = this._readState();
      this._load(route, params, { animate: true, push: false });
    });

    console.log("[ROUTER] v13 loaded");
  }

  start() {
    const { route, params } = this._readState();
    this._load(route, params, { animate: false, push: false });
  }

  navigateTo(route, params = {}) {
    const normalized = normalizeRoute(route);
    this._load(normalized, params, { animate: true, push: true });
  }

  _readState() {
    const url = new URL(window.location.href);
    const queryRoute = url.searchParams.get("route");
    const route = normalizeRoute(
      (history.state && history.state.route) || queryRoute || "main"
    );
    const params = (history.state && history.state.params) || {};
    if (!routePaths.has(route)) {
      console.warn("[ROUTER] Unknown route -> fallback main:", route);
      return { route: "main", params: {} };
    }
    return { route, params };
  }

  async _load(route, params, { animate, push }) {
    const path = routePaths.get(route);
    const Page = this.pages[route];

    // 1) грузим HTML следующей страницы во второй слой
    const html = await this._fetchHtml(path);
    this.$next.html(html).show();
    this.$current.show();

    // 2) анимируем своп слоёв
    if (animate) {
      await this._animateSwap();
    } else {
      this.$current.html(this.$next.html());
      this.$next.hide().empty();
    }

    // 3) записываем историю/URL ?route=...
    const url = new URL(window.location.href);
    url.searchParams.set("route", route);
    if (push) history.pushState({ route, params }, "", url);
    else      history.replaceState({ route, params }, "", url);

    // 4) запускаем логику страницы
    try {
      await Page.load(params || {});
    } catch (e) {
      console.error("[ROUTER] page load error:", e);
    }
  }

  async _fetchHtml(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch page: ${path}`);
    return await res.text();
  }

  _animateSwap() {
    // два слоя: #page-current и #page-next
    return new Promise((resolve) => {
      const duration = 220;

      this.$next.css({ x: "100%", opacity: 1, display: "block" });
      this.$current.css({ x: "0%",   opacity: 1, display: "block" });

      this.$next.transition({ x: "0%" }, duration, "easeOutCubic");
      this.$current
        .transition({ x: "-30%", opacity: 0.3 }, duration, "easeOutCubic", () => {
          this.$current.html(this.$next.html()).css({ x: "0%", opacity: 1 });
          this.$next.hide().empty().css({ x: "100%", opacity: 1 });
          resolve();
        });
    });
  }
}

export const router = new Router();

// Совместимость с твоим index.js — он импортирует именованный bootRouter
export function bootRouter() {
  try {
    router.start();
  } catch (e) {
    console.error("[ROUTER] bootRouter failed:", e);
  }
}

export const navigateTo = (route, params) => router.navigateTo(route, params);
export default Router;