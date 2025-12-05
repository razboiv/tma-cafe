// frontend/js/routing/router.js

import MainPage from "../pages/main.js";
import CategoryPage from "../pages/category.js";
import DetailsPage from "../pages/details.js";
import CartPage from "../pages/cart.js";
import TelegramSDK from "../telegram/telegram.js";
import Snackbar from "../utils/snackbar.js";

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
 * In-memory HTML cache.
 */
const pageContentCache = {};

let currentRoute = null;
let pageContentLoadRequest = null;
let pendingAnimations = false;
let animationRunning = false;

/**
 * Navigate to another page.
 *
 * @param {string} dest  destination route ("root", "category", "details", "cart")
 * @param {*} params     params that will be encoded to URL
 */
export function navigateTo(dest, params) {
  let url = `?dest=${dest}`;

  if (params != null) {
    url += "&params=" + encodeURIComponent(params);
  }

  // keep hash (Telegram can put something there)
  window.history.pushState({}, "", url + window.location.hash);

  handleLocation(false);
}

/**
 * Router engine – detects which page to load.
 *
 * @param {boolean} reverse  run animation in reverse (back navigation)
 */
export function handleLocation(reverse) {
  // close previous route if any
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
  if (!currentRoute) {
    return;
  }

  // cancel previous request if any
  if (pageContentLoadRequest != null) {
    pageContentLoadRequest.abort();
  }

  // decide which container will be "next"
  if ($("#page-current").contents().length > 0) {
    pageContentLoadRequest = loadPage("#page-next", currentRoute.contentPath, () => {
      pageContentLoadRequest = null;
      currentRoute.load(loadParams);
    });
    animatePageChange(reverse);
  } else {
    pageContentLoadRequest = loadPage("#page-current", currentRoute.contentPath, () => {
      pageContentLoadRequest = null;
      currentRoute.load(loadParams);
    });
  }

  if (currentRoute.dest !== "root") {
    TelegramSDK.showBackButton(() => history.back());
  } else {
    TelegramSDK.hideBackButton();
  }
}

/**
 * Load page content (HTML). Can be loaded from cache or from server.
 *
 * @param {string} pageContainerSelector
 * @param {string} pagePath
 * @param {Function} onSuccess
 * @returns {jqXHR|null}
 */
function loadPage(pageContainerSelector, pagePath, onSuccess) {
  const container = $(pageContainerSelector);
  const page = pageContentCache[pagePath];

  if (page != null) {
    container.html(page);
    onSuccess();
    return null;
  }

  return $.ajax({
    url: pagePath,
    success: (pageHtml) => {
      pageContentCache[pagePath] = pageHtml;
      container.html(pageHtml);
      onSuccess();
    },
  });
}

/**
 * Run navigation animations for outgoing and ingoing pages.
 *
 * @param {boolean} reverse
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
 * Reset containers after animation.
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
 * @param {string} text   Snackbar text
 * @param {string} style  "success" | "warning" | "error" | anything
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
