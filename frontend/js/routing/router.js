// frontend/js/routing/router.js
import { MainPage } from "../pages/main.js";
import { CategoryPage } from "../pages/category.js";
import { DetailsPage } from "../pages/details.js";
import { CartPage } from "../pages/cart.js";
import { TelegramSDK } from "../telegram/telegram.js";
import { Snackbar } from "../utils/snackbar.js";

// ===== маршруты (как в оригинале) =====
const availableRoutes = [
  new MainPage(),
  new CategoryPage(),
  new DetailsPage(),
  new CartPage(),
];

// ===== кэш страниц (как в оригинале) =====
class CachedPageElement {
  #html; #timeStored;
  constructor(html, timeStored) { this.#html = html; this.#timeStored = timeStored; }
  cachedRecently(threshold) { return this.#timeStored >= threshold; }
  html() { return this.#html; }
  storedTime() { return this.#timeStored; }
}

class PageContentCache {
  #store = {};
  #ordered = [];
  get(key) {
    const now = Date.now();
    const v = this.#store[key];
    if (!v) return null;
    if (v.cachedRecently(now - CACHE_TTL_MS)) return v;
    delete this.#store[key];
    this.#ordered = this.#ordered.filter(k => k !== key);
    return null;
  }
  put(key, html) {
    this.#store[key] = new CachedPageElement(html, Date.now());
    this.#ordered.unshift(key);
  }
  reduce(keep) {
    if (this.#ordered.length <= keep) return;
    const drop = this.#ordered.slice(keep);
    drop.forEach(k => delete this.#store[k]);
    this.#ordered = this.#ordered.slice(0, keep);
  }
}

const CACHE_TTL_MS = 1000 * 60 * 60;
const CACHE_KEEP = 3;
const pageCache = new PageContentCache();
const pageContentCache = {}; // html кеш по ключу contentPath
const PAGE_LOAD_DELAY = 200;

// ===== состояние роутера =====
let currentRoute = null;
let cancelCurrentLoad = null;   // функция-отмена загрузки HTML
let animationRunning = false;
let pendingAnimations = false;

// ===== константы анимации (jQuery Transit) =====
const previousPageLeft = "-35%";
const nextPageLeftFrom = "100%";
const currentPageLeftTo = "-35%";
const currentPageZ = "1";
const nextPageZ = "2";

function getCacheKey(path) { return path; }

// ---- Загрузка HTML одного экрана (одна реализация, без дублей) ----
function loadPage(pageContainerSelector, pagePath, onLoad) {
  // пробуем html-кеш (живёт, пока открыт WebView)
  const mem = pageContentCache[pagePath];
  if (mem) {
    $(pageContainerSelector).html(mem);
    setTimeout(onLoad, PAGE_LOAD_DELAY);
    return null;
  }

  // пробуем дисковый кеш (по времени)
  const cached = pageCache.get(getCacheKey(pagePath));
  if (cached) {
    $(pageContainerSelector).html(cached.html());
    setTimeout(onLoad, PAGE_LOAD_DELAY);
    return null;
  }

  // обычный fetch с возможностью отмены
  const controller = new AbortController();
  fetch(pagePath, { signal: controller.signal })
    .then(r => r.text())
    .then(html => {
      // после удачной загрузки положим в кэш
      pageCache.put(getCacheKey(pagePath), html);
      pageCache.reduce(CACHE_KEEP);
      $(pageContainerSelector).html(html);
      onLoad();
    })
    .catch(() => { /* ignore if aborted */ });

  return () => controller.abort();
}

// ---- Анимация перехода ----
function animate(run, reverse) {
  // ⛑️ БЕЗОПАСНАЯ ПЕРВАЯ ОТРИСОВКА: если run === false — просто выставим стейты и выйдем
  if (!run) {
    $("#page-current").css({ display: "", transform: "", "z-index": nextPageZ });
    $("#page-next").css({ display: "none", transform: "", "z-index": currentPageZ }).empty();
    animationRunning = false;
    return;
  }

  animationRunning = true;

  const curTo = reverse ? nextPageLeftFrom : previousPageLeft;
  const nextFrom = reverse ? previousPageLeft : nextPageLeftFrom;

  $("#page-current")
    .css({ transform: "", "z-index": currentPageZ })
    .transition({ x: curTo }, 325);

  $("#page-next")
    .css({ display: "", transform: `translate(${nextFrom})`, "z-index": nextPageZ })
    .transition({ x: "0px" }, 325, () => {
      animationRunning = false;
      restoreContainers();
      if (pendingAnimations) {
        pendingAnimations = false;
        processLocation(reverse);
      }
    });
}

function restoreContainers() {
  const cur = $("#page-current");
  const next = $("#page-next");

  cur.attr("id", "page-next")
     .css({ display: "none", transform: "", "z-index": "1" })
     .empty();

  next.attr("id", "page-current")
      .css({ display: "", transform: "", "z-index": "2" });
}

// ---- Основная логика навигации (внутренняя) ----
function processLocation(reverse = false) {
  const search = window.location.search;

  if (search === "") {
    navigateTo("root");
    return;
  }

  if (animationRunning) { pendingAnimations = true; return; }
  if (currentRoute) currentRoute.onClose();
  if (typeof cancelCurrentLoad === "function") { cancelCurrentLoad(); cancelCurrentLoad = null; }

  const sp = new URLSearchParams(search);
  const dest = sp.get("dest") || "root";
  const encoded = sp.get("params");
  const params = encoded ? decodeURIComponent(encoded) : undefined;

  currentRoute = availableRoutes.find(r => r.dest === dest) || availableRoutes[0];

  const hasCurrentContent = $("#page-current").contents().length > 0;

  if (hasCurrentContent) {
    // обычный переход с анимацией
    cancelCurrentLoad = loadPage("#page-next", currentRoute.contentPath, () => {
      cancelCurrentLoad = null;
      currentRoute.load(params);
    });
    animate(true, reverse);
  } else {
    // первый рендер — БЕЗ анимации
    cancelCurrentLoad = loadPage("#page-current", currentRoute.contentPath, () => {
      cancelCurrentLoad = null;
      currentRoute.load(params);
    });
    animate(false, false); // noop: просто корректно выставит состояния контейнеров
  }

  if (currentRoute.dest !== "root") {
    TelegramSDK.showBackButton(() => history.back());
  } else {
    TelegramSDK.hideBackButton();
  }
}

// ---- Публичные API ----
export function navigateTo(dest, params) {
  let url = `?dest=${dest}`;
  if (params != null) url += `&params=${encodeURIComponent(params)}`;
  window.history.pushState({}, "", url + location.hash);
  processLocation(false);
}

export function handleLocation() {
  // браузерная навигация
  window.addEventListener("popstate", () => processLocation(true));
  window.addEventListener("hashchange", () => processLocation(true));
  // стартовая загрузка
  processLocation(false);
}

export function showSnackbar(text, style) {
  const colorVar = style === "success" ? "--success-color"
                 : style === "warning" ? "--warning-color"
                 : style === "error"   ? "--error-color"
                 : "--accent-color";

  Snackbar.showSnackbar("content", text, {
    backgroundColor: `var(${colorVar})`,
    color: "#000000",
    duration: 1500,
    margins: { left: "16px", right: "16px", top: "12px" }
  });

  const haptic = style === "success" ? "soft" : style === "warning" ? "medium" : "error";
  TelegramSDK.notificationOccured(haptic);
}