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
 * When we load content for the route (HTML), we save it there
 * in format { '/path/to/content.html': '<div>...loaded content</div>' }.
 * When we go to the route with contentPath that exists in cache, we load
 * page from there. This is optimization for route content HTML only,
 * the Route.load(params) method is calling anyway to load new portion of the data.
 *
 * This is in-memory cache, since we want to store it only for the current app opening.
 */
const pageContentCache = {};

/** Currently selected route (instance of Route child). */
let currentRoute;

/** Currently executing route (page) content load request. */
let pageContentLoadRequest;

/** Indicates that we have one more navigation request while animation was running. */
let pendingAnimations = false;

/** Indicates currently running navigation animation. */
let animationRunning = false;

/**
 * Request for navigating to some destination.
 * @param {string} dest  Route dest, one of availableRoutes.dest.
 * @param {*}      params Params that you'd like to pass to the new destination (route).
 */
export function navigateTo(dest, params) {
  let url = `?dest=${dest}`;
  if (params != null) {
    url += `&params=${encodeURIComponent(params)}`;
  }

  // Keep URL hash part since it may be filled by Telegram.
  window.history.pushState({}, "", url + window.location.hash);
  handleLocation(false);
}

/**
 * Handle location defined in the current URL.
 * Performs:
 *  - Find desired route or fallback to default ('root').
 *  - Run navigation animation (slide-in/slide-out).
 *  - Controls Telegram's back button.
 */
export function handleLocation(reverse) {
  const search = window.location.search;

  if (currentRoute != null) {
    currentRoute.onClose();
  }

  const searchParams = new URLSearchParams(search);
  const dest = searchParams.get("dest") || "root";
  const encodedLoadParams = searchParams.get("params");

  let loadParams = null;
  if (encodedLoadParams != null) {
    loadParams = decodeURIComponent(encodedLoadParams);
  }

  currentRoute =
    availableRoutes.find((route) => dest === route.dest) || availableRoutes[0];

  // Abort previous loading if it is still in progress
  if (pageContentLoadRequest != null) {
    pageContentLoadRequest.abort();
  }

  // If there is already something in #page-current – we load into #page-next
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
    // First load – directly into #page-current
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
 * Load page content (HTML).
 * The content may be loaded from the server, or from cache.
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
    success: (page) => {
      pageContentCache[pagePath] = page;
      container.html(page);
      onSuccess();
    },
  });
}

/**
 * Run navigation animations for outgoing and ingoing pages.
 * @param {boolean} reverse  If true, animation runs in reverse direction (back).
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
      transform: `translate(${nextPageLeftFrom})`,
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
 * Attaches to the top-level '#content' container.
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
 * Handle browser back button (history).
 */
window.onpopstate = () => handleLocation(true);
