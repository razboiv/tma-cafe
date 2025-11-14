// frontend/js/routing/router.js

import MainPage from "../pages/main.js";
import CategoryPage from "../pages/category.js";
import DetailsPage from "../pages/details.js";
import CartPage from "../pages/cart.js";
import { TelegramSDK } from "../telegram/telegram.js";
import { Snackbar } from "../utils/snackbar.js";

/**
 * List of available routes (pages).
 */
const availableRoutes = [
  new MainPage(),
  new CategoryPage(),
  new DetailsPage(),
  new CartPage(),
];

/**
 * In-memory HTML cache
 */
const pageContentCache = {};

let currentRoute = null;
let pageContentLoadRequest = null;

/**
 * Indicates that we have one more navigation request
 * while navigation animation was running.
 */
let pendingAnimations = false;

/**
 * Indicates currently running navigation animation.
 */
let animationRunning = false;

/**
 * Request navigation to some destination.
 *
 * @param {string} dest  one of route.dest (root, category, details, cart)
 * @param {*}      params  any params, will be encoded in URL
 */
export function navigateTo(dest, params) {
  let url = `?dest=${dest}`;
  if (params != null) {
    url += `&params=${encodeURIComponent(params)}`;
  }

  // keep hash part (Telegram may use it)
  window.history.pushState({}, "", url + location.hash);
  handleLocation(false);
}

/**
 * Router engine — detects which page to load
 */
export function handleLocation(reverse) {
  // если сейчас идёт анимация — запомним, что
  // нужно ещё раз обработать location после неё
  if (animationRunning) {
    pendingAnimations = true;
    return;
  }

  if (currentRoute != null) {
    currentRoute.onClose();
  }

  const search = window.location.search;
  const searchParams = new URLSearchParams(search);

  const dest = searchParams.get("dest") || "root";
  const encodedLoadParams = searchParams.get("params");

  let loadParams = null;

  if (encodedLoadParams != null) {
    try {
      loadParams = decodeURIComponent(encodedLoadParams);
    } catch (e) {
      console.error("Failed to decode params", e);
    }
  }

  currentRoute = availableRoutes.find((r) => r.dest === dest);
  if (!currentRoute) return;

  if (pageContentLoadRequest != null) {
    pageContentLoadRequest.abort();
  }

  // если уже есть контент в #page-current — грузим в #page-next и запускаем анимацию
  if ($("#page-current").contents().length > 0) {
    pageContentLoadRequest = loadPage(
      "#page-next",
      currentRoute.contentPath,
      () => {
        pageContentLoadRequest = null;
        currentRoute.load(loadParams);
      },
    );
    animatePageChange(reverse);
  } else {
    // первый запуск — просто грузим в #page-current без анимации
    pageContentLoadRequest = loadPage(
      "#page-current",
      currentRoute.contentPath,
      () => {
        pageContentLoadRequest = null;
        currentRoute.load(loadParams);
      },
    );
  }

  if (currentRoute.dest !== "root") {
    TelegramSDK.showBackButton(() => history.back());
  } else {
    TelegramSDK.hideBackButton();
  }
}

/**
 * Load page content (HTML). Can be loaded from server or cache.
 *
 * @param {string}   pageContainerSelector  '#page-current' or '#page-next'
 * @param {string}   pagePath               Route.contentPath (e.g. '/pages/main.html')
 * @param {Function} onSuccess              called when page is loaded and inserted into DOM
 * @returns {jqXHR|null}
 */
function loadPage(pageContainerSelector, pagePath, onSuccess) {
  const container = $(pageContainerSelector);
  const page = pageContentCache[pagePath];

  if (page != null) {
    container.html(page);
    onSuccess();
    return null;
  } else {
    return $.ajax({
      url: pagePath,
      success: (page) => {
        pageContentCache[pagePath] = page;
        container.html(page);
        onSuccess();
      },
    });
  }
}

/**
 * Run navigation animations for outgoing and ingoing pages.
 * @param {boolean} reverse  use reverse animation (for back navigation)
 */
function animatePageChange(reverse) {
  animationRunning = true;

  const currentPageZIndex = reverse ? "2" : "1";
  const currentPageLeftTo = reverse ? "100vw" : "-25vw";
  const nextPageZIndex = reverse ? "1" : "2";
  const nextPageLeftFrom = reverse ? "-25vw" : "100vw";

  $("#page-current")
    .css({
      transform: "",
      "z-index": currentPageZIndex,
    })
    .transition({ x: currentPageLeftTo }, 325);

  $("#page-next")
    .css({
      display: "",
      transform: `translate(${nextPageLeftFrom}, 0px)`,
      "z-index": nextPageZIndex,
    })
    .transition({ x: "0px" }, 325, () => {
      animationRunning = false;
      restorePagesInitialState();

      if (pendingAnimations) {
        pendingAnimations = false;
        handleLocation(reverse);
      }
    });
}

/**
 * Reset page containers values to default ones.
 * Should be run when navigation animation is finished.
 */
function restorePagesInitialState() {
  const currentPage = $("#page-current");
  const nextPage = $("#page-next");

  currentPage
    .attr("id", "page-next")
    .css({
      display: "none",
      "z-index": "1",
    })
    .empty();

  nextPage
    .attr("id", "page-current")
    .css({
      display: "",
      transform: "",
      "z-index": "2",
    });
}

/**
 * Show snackbar on top of the page content.
 *
 * @param {string} text  Snackbar text.
 * @param {string} style 'success' | 'warning' | 'error' | anything
 */
export function showSnackbar(text, style) {
  const colorVariable =
    style === "success"
      ? "--success-color"
      : style === "warning"
      ? "--warning-color"
      : style === "error"
      ? "--error-color"
      : "--accent-color";

  Snackbar.showSnackbar("content", text, {
    "background-color": `var(${colorVariable})`,
  });

  TelegramSDK.notificationOccured(style);
}

/**
 * Handle browser back button.
 */
window.onpopstate = () => handleLocation(true);
