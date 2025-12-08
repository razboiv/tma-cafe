// frontend/js/routing/router.js  (v14)

import { Route } from "./route.js";
import TelegramSDK from "../telegram/telegram.js";

// ---- утилиты ---------------------------------------------------------------
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

const VERSION = (window.__BUILD_VERSION__ || Date.now()) + ""; // кэш-бастер

const PAGE_HTML = {
  main:     "../pages/main.html",
  category: "../pages/category.html",
  details:  "../pages/details.html",
  cart:     "../pages/cart.html",
};

// Жёсткие импортёры модулей страниц (чтобы не было проблем с относительными путями)
const importers = {
  main:     () => import(`../pages/main.js?v=${VERSION}`),
  category: () => import(`../pages/category.js?v=${VERSION}`),
  details:  () => import(`../pages/details.js?v=${VERSION}`),
  cart:     () => import(`../pages/cart.js?v=${VERSION}`),
};

// ---- базовый no-op объект страницы ----------------------------------------
class NoopPage extends Route {
  constructor(ctx = {}) { super(ctx); this.name = ctx.name || "noop"; }
  async load() {}
  async unload() {}
}

// ---- загрузка HTML шаблона в #app-content ---------------------------------
async function loadHTML(page) {
  const url = PAGE_HTML[page];
  if (!url) throw new Error(`[ROUTER] Unknown page html: ${page}`);

  const res = await fetch(`${url}?v=${VERSION}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`[ROUTER] Failed to fetch html for ${page}: ${res.status}`);
  const html = await res.text();

  const host = qs("#app-content") || document.body;
  host.innerHTML = html;
}

// ---- извлечение конструктора/инстанса из модуля ---------------------------
function resolveCtorOrInstance(pageName, mod, ctx) {
  // модуль может экспортировать по-разному
  const candidates = [
    mod?.default,
    mod?.MainPage,
    mod?.Page,
    mod?.[`${pageName[0].toUpperCase()}${pageName.slice(1)}Page`],
  ].filter(Boolean);

  if (candidates.length) {
    const Ctor = candidates[0];
    try {
      // класс/функция-конструктор?
      const inst = typeof Ctor === "function" ? new Ctor(ctx) : Ctor;
      if (inst && typeof inst.load === "function") return inst;
    } catch (e) {
      console.warn("[ROUTER] Failed to construct page from export, fallback to function shape", e);
    }
  }

  // возможно экспортированы функции load/unload
  if (typeof mod?.load === "function") {
    const loadFn = mod.load;
    const unloadFn = typeof mod.unload === "function" ? mod.unload : () => {};
    return {
      name: pageName,
      async load(p) { await loadFn(p, ctx); },
      async unload() { await unloadFn(ctx); }
    };
  }

  console.warn("[ROUTER] Could not resolve Page from module, using Noop:", mod);
  return new NoopPage(ctx);
}

// ---- сам роутер ------------------------------------------------------------
export class Router {
  constructor() {
    this.current = null;        // текущий инстанс страницы
    this.currentName = null;    // имя страницы
    this.history = [];          // стек имён страниц
    this.isBooted = false;
  }

  async start() {
    if (this.isBooted) return;
    this.isBooted = true;

    console.info("[ROUTER] v14 loaded");

    // подписка на кнопку «Назад»
    TelegramSDK.onEvent("back_button_pressed", async () => {
      await this.back();
    });

    await this.go("main");
  }

  async back() {
    if (this.history.length <= 1) return;        // уже на корне
    // снять вершину (текущую) и взять предыдущую
    this.history.pop();
    const prev = this.history.pop();             // go() снова положит
    await this.go(prev || "main");
  }

  async go(name, params = {}) {
    // если идём на ту же страницу — просто перерисуем (например, после back)
    const same = this.currentName === name;

    // 1) HTML шаблон
    await loadHTML(name);

    // 2) выгрузить прошлую страницу
    if (this.current && typeof this.current.unload === "function") {
      try { await this.current.unload(); } catch (e) { console.warn("[ROUTER] unload error", e); }
    }

    // 3) импорт модуля страницы (с кэш-бастером и жёсткими путями)
    let mod;
    try {
      const importer = importers[name];
      if (!importer) throw new Error(`No importer for page ${name}`);
      mod = await importer();
    } catch (e) {
      console.error(`[ROUTER] Failed dynamic import for ${name}`, e);
      mod = {}; // пусть уйдём в Noop — не уронит приложение
    }

    // 4) создать инстанс страницы
    const ctx = { name, params, $, $$: qsa };
    const page = resolveCtorOrInstance(name, mod, ctx);

    // 5) отрисовать
    try {
      await page.load(params);
    } catch (e) {
      console.error(`[ROUTER] page.load() failed for ${name}`, e);
    }

    // 6) состояние «Назад»
    this.current = page;
    this.currentName = name;
    if (!same) this.history.push(name);

    const isRoot = name === "main";
    TelegramSDK.BackButton?.[isRoot ? "hide" : "show"]?.();

    return page;
  }
}

// --- публичные помощники ----------------------------------------------------
let __router = null;

export function bootRouter() {
  if (!__router) __router = new Router();
  __router.start();
  return __router;
}

export function navigateTo(name, params = {}) {
  if (!__router) __router = new Router();
  return __router.go(name, params);
}

export function handleLocation() {
  // для совместимости со старым индексом
  return bootRouter();
}

export default { Router, bootRouter, navigateTo, handleLocation };