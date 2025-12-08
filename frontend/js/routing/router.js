// frontend/js/routing/router.js
import Route from "./route.js";

// === Страницы (СТАТИЧЕСКИЕ ИМПОРТЫ!) ===
import MainPage    from "../pages/main.js";
import CategoryPage from "../pages/category.js";
import DetailsPage  from "../pages/details.js";
import CartPage     from "../pages/cart.js";

// ==== Настройки путей ====
const routePaths = new Map([
  ["main",     "/frontend/pages/main.html"],
  ["category", "/frontend/pages/category.html"],
  ["details",  "/frontend/pages/details.html"],
  ["cart",     "/frontend/pages/cart.html"],
]);

// Алиасы: Telegram иногда присылает route=root
const ROUTE_ALIASES = new Map([
  ["root",  "main"],
  ["home",  "main"],
  ["index", "main"],
]);

function normalizeRoute(name) {
  const r = (name || "main").trim();
  return ROUTE_ALIASES.get(r) || r;
}

// === Роутер ===
class Router {
  constructor() {
    this.pages = {
      main:     new MainPage(),
      category: new CategoryPage(),
      details:  new DetailsPage(),
      cart:     new CartPage(),
    };

    this.$current = $("#page-current");
    this.$next    = $("#page-next");

    // popstate (стрелка «Назад» браузера / Telegram back)
    window.addEventListener("popstate", () => {
      const { route, params } = this._readState();
      this._load(route, params, { animate: true, push: false });
    });

    console.log("[ROUTER] v10 loaded");
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

    // 1) Подготовка контейнера next: грузим HTML шаблон страницы
    this.$next.html(await this._fetchHtml(path)).show();
    this.$current.show();

    // 2) Анимация смены страниц
    if (animate) {
      await this._animateSwap();
    } else {
      // без анимации — просто заменить
      this.$current.html(this.$next.html());
      this.$next.hide().empty();
    }

    // 3) История
    if (push) {
      const url = new URL(window.location.href);
      url.searchParams.set("route", route);
      history.pushState({ route, params }, "", url);
    } else {
      // при первой загрузке корректируем state, чтобы back работал
      const url = new URL(window.location.href);
      url.searchParams.set("route", route);
      history.replaceState({ route, params }, "", url);
    }

    // 4) Вызов логики страницы
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
    // классическая анимация «свайпом»
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

// === Синглтон роутера и экспорт хелперов ===
export const router = new Router();
export const navigateTo = (route, params) => router.navigateTo(route, params);
export default Router;