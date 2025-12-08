// frontend/js/routing/router.js

import TelegramSDK from "../telegram/telegram.js";

console.log("[ROUTER] v13 loaded");

// ---------- совместимость с разными обёртками Telegram SDK ----------

function bindBackHandler(handler) {
  const t = window.Telegram?.WebApp;

  // варианты в твоём telegram.js
  if (TelegramSDK && typeof TelegramSDK.onBackButton === "function") {
    TelegramSDK.onBackButton(handler);
    return;
  }
  if (TelegramSDK && typeof TelegramSDK.onBackButtonClick === "function") {
    TelegramSDK.onBackButtonClick(handler);
    return;
  }
  if (TelegramSDK?.BackButton && typeof TelegramSDK.BackButton.onClick === "function") {
    TelegramSDK.BackButton.onClick(handler);
    return;
  }

  // нативный Telegram.WebApp
  if (t?.BackButton && typeof t.BackButton.onClick === "function") {
    t.BackButton.onClick(handler);
    return;
  }

  // совсем уж запасной вариант (браузерная «назад»)
  window.addEventListener("popstate", () => handler());
}

function setBackButtonVisible(isVisible) {
  const t = window.Telegram?.WebApp;

  // обёртки
  if (typeof TelegramSDK?.showBackButton === "function") {
    TelegramSDK.showBackButton(isVisible);
    return;
  }
  if (typeof TelegramSDK?.setBackButtonVisible === "function") {
    TelegramSDK.setBackButtonVisible(isVisible);
    return;
  }
  if (TelegramSDK?.BackButton) {
    const BB = TelegramSDK.BackButton;
    if (isVisible && typeof BB.show === "function") return BB.show();
    if (!isVisible && typeof BB.hide === "function") return BB.hide();
  }

  // нативный Telegram.WebApp
  if (t?.BackButton) {
    if (isVisible && typeof t.BackButton.show === "function") t.BackButton.show();
    if (!isVisible && typeof t.BackButton.hide === "function") t.BackButton.hide();
  }
}

// ---------- ленивые модули страниц ----------

const PAGES = {
  main:     () => import("../pages/main.js?v=13"),
  category: () => import("../pages/category.js?v=13"),
  details:  () => import("../pages/details.js?v=13"),
  cart:     () => import("../pages/cart.js?v=13"),
};

// извлекаем класс/инстанс страницы из модуля «как получится»
function resolveCtorOrInstance(mod, nameHint) {
  try {
    if (mod && "default" in mod && mod.default) {
      const d = mod.default;
      if (typeof d === "function") return d;
      if (typeof d === "object")   return d;
    }
    const title = nameHint ? nameHint[0].toUpperCase() + nameHint.slice(1) : null;
    const candidates = [
      "Page","MainPage","CategoryPage","DetailsPage","CartPage",
      title && `${title}Page`,
    ].filter(Boolean);

    for (const key of candidates) {
      const v = mod[key];
      if (typeof v === "function") return v;
      if (v && typeof v === "object") return v;
    }

    if (typeof mod.load === "function") {
      return {
        load:   (...a) => mod.load(...a),
        unload: typeof mod.unload === "function" ? (...a) => mod.unload(...a) : undefined,
      };
    }

    for (const v of Object.values(mod)) {
      if (typeof v === "function") return v;
      if (v && typeof v === "object" && typeof v.load === "function") return v;
    }
  } catch (e) {
    console.warn("[ROUTER] resolve error:", e);
  }
  console.warn("[ROUTER] Could not resolve Page from module, using Noop");
  return { load() {} };
}

function asInstance(ctorOrObj, params) {
  if (typeof ctorOrObj === "function") {
    try { return new ctorOrObj(params); } catch {
      const maybe = ctorOrObj(params);
      return (maybe && typeof maybe === "object") ? maybe : { load() {} };
    }
  }
  return ctorOrObj || { load() {} };
}

// ---------- сам роутер ----------

class Router {
  constructor() {
    this.stack = [];
    this.current = null;
    bindBackHandler(() => this.back());
  }

  async loadModule(name) {
    const loader = PAGES[name] || PAGES.main;
    const mod = await loader();
    try { console.debug(`[ROUTER] module '${name}' keys:`, Object.keys(mod)); } catch {}
    return mod;
  }

  async go(name, params = {}) {
    if (this.current?.page?.unload) {
      try { await this.current.page.unload(); } catch (e) { console.warn(e); }
    }

    const mod = await this.loadModule(name);
    const ctorOrInstance = resolveCtorOrInstance(mod, name);
    const page = asInstance(ctorOrInstance, params);

    this.current = { name, page, params };
    this.stack.push(this.current);

    setBackButtonVisible(this.stack.length > 1);

    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}

    if (typeof page.load === "function") {
      await page.load(params);
    } else {
      console.warn(`[ROUTER] page '${name}' has no load()`);
    }
  }

  async back() {
    if (this.stack.length <= 1) {
      setBackButtonVisible(false);
      return;
    }

    const cur = this.stack.pop();
    if (cur?.page?.unload) {
      try { await cur.page.unload(); } catch (e) { console.warn(e); }
    }

    const prev = this.stack[this.stack.length - 1];
    this.current = prev;
    setBackButtonVisible(this.stack.length > 1);

    if (prev?.page?.load) {
      await prev.page.load(prev.params || {});
    }
  }

  async start(startName = "main", params = {}) {
    await this.go(startName, params);
  }
}

// ---------- экспорт API, совместимый со старым кодом ----------

let _router;

export function bootRouter(start = "main", params = {}) {
  if (!_router) _router = new Router();
  _router.start(start, params);
  return _router;
}

export function navigateTo(name, params = {}) {
  if (!_router) bootRouter();
  return _router.go(name, params);
}

export function handleLocation(name = "main", params = {}) {
  return navigateTo(name, params);
}

export default Router;