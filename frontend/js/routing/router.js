// frontend/js/routing/router.js

import TelegramSDK from "../telegram/telegram.js";

console.log("[ROUTER] v13 loaded");

// ---- карта лениво подгружаемых страниц ----
const PAGES = {
  main:     () => import("../pages/main.js?v=13"),
  category: () => import("../pages/category.js?v=13"),
  details:  () => import("../pages/details.js?v=13"),
  cart:     () => import("../pages/cart.js?v=13"),
};

// ---- утилиты распознавания экспорта страницы ----
function resolveCtorOrInstance(mod, nameHint) {
  try {
    // 1) default экспорт (класс или инстанс)
    if (mod && "default" in mod && mod.default) {
      const d = mod.default;
      if (typeof d === "function") return d;      // класс/фабрика
      if (typeof d === "object")   return d;      // готовый инстанс
    }

    // 2) набор распространённых имён классов/инстансов
    const title = nameHint ? nameHint[0].toUpperCase() + nameHint.slice(1) : null;
    const candidates = [
      "Page",
      "MainPage",
      "CategoryPage",
      "DetailsPage",
      "CartPage",
      title && `${title}Page`,
    ].filter(Boolean);

    for (const key of candidates) {
      const v = mod[key];
      if (typeof v === "function") return v;
      if (v && typeof v === "object") return v;
    }

    // 3) модуль экспортирует только функции жизненного цикла (load/unload)
    if (typeof mod.load === "function") {
      return {
        load:    (...args) => mod.load(...args),
        unload:  typeof mod.unload === "function" ? (...a) => mod.unload(...a) : undefined,
      };
    }

    // 4) взять первый “вменяемый” экспорт (класс/функция/объект c load)
    for (const [k, v] of Object.entries(mod)) {
      if (typeof v === "function") return v;
      if (v && typeof v === "object" && typeof v.load === "function") return v;
    }
  } catch (e) {
    console.warn("[ROUTER] resolve error:", e);
  }

  console.warn("[ROUTER] Could not resolve Page from module, using Noop:", mod);
  return { load() {} }; // безопасный no-op инстанс
}

function asInstance(ctorOrObj, params) {
  if (typeof ctorOrObj === "function") {
    // это класс или фабрика
    try {
      return new ctorOrObj(params);
    } catch {
      const maybeObj = ctorOrObj(params);
      if (maybeObj && typeof maybeObj === "object") return maybeObj;
      // если это была просто функция без возврата — вернём заглушку
      return { load() {} };
    }
  }
  return ctorOrObj || { load() {} };
}

// ---- сам роутер ----
class Router {
  constructor() {
    this.stack = []; // { name, page }
    this.current = null;

    // обработчик системной “назад”
    TelegramSDK.onBackButton(() => this.back());
  }

  async loadModule(name) {
    const loader = PAGES[name] || PAGES.main; // fallback
    const mod = await loader();
    // небольшая подсказка в логи — какие ключи есть у модуля
    try {
      console.debug(`[ROUTER] module '${name}' keys:`, Object.keys(mod));
    } catch {}
    return mod;
  }

  async go(name, params = {}) {
    // выгрузим текущую
    if (this.current?.page?.unload) {
      try { await this.current.page.unload(); } catch (e) { console.warn(e); }
    }

    const mod = await this.loadModule(name);
    const ctorOrInstance = resolveCtorOrInstance(mod, name);
    const page = asInstance(ctorOrInstance, params);

    this.current = { name, page };
    this.stack.push(this.current);

    // показать/скрыть back в зависимости от глубины
    TelegramSDK.showBackButton(this.stack.length > 1);

    // плавная прокрутка к началу, чтоб не “прыгало”
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}

    // загрузка страницы
    if (typeof page.load === "function") {
      await page.load(params);
    } else {
      console.warn(`[ROUTER] page '${name}' has no load()`);
    }
  }

  async back() {
    if (this.stack.length <= 1) {
      TelegramSDK.showBackButton(false);
      return; // корень — нечего назад
    }

    // убрать текущую
    const current = this.stack.pop();
    if (current?.page?.unload) {
      try { await current.page.unload(); } catch (e) { console.warn(e); }
    }

    const prev = this.stack[this.stack.length - 1];
    this.current = prev;
    TelegramSDK.showBackButton(this.stack.length > 1);

    // перерисовать предыдущую (без повторной загрузки модуля)
    if (prev?.page?.load) {
      await prev.page.load(prev.params || {});
    }
  }

  // стартует приложение
  async start(startName = "main", params = {}) {
    await this.go(startName, params);
  }
}

// ---- синглтон + API, которое ждут остальные файлы ----
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
  // совместимость со старым index.js
  return navigateTo(name, params);
}

export default Router;