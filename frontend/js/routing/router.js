// frontend/js/routing/router.js

import MainPage from "../pages/main.js";
import CategoryPage from "../pages/category.js";
import DetailsPage from "../pages/details.js";
import CartPage from "../pages/cart.js";

import TelegramSDK from "../telegram/telegram.js";

/**
 * List of available routes (pages).
 */
const availableRoutes = [
    new MainPage(),
    new CategoryPage(),
    new DetailsPage(),
    new CartPage()
];

/**
 * In-memory HTML cache
 */
const pageContentCache = {};

let currentRoute = null;
let pageContentLoadRequest = null;
let pendingAnimations = false;
let animationRunning = false;


/**
 * Navigate to another page
 */
export function navigateTo(dest, params) {
    let url = "?dest=" + dest;

    if (params != null) {
        url += "&params=" + encodeURIComponent(params);
    }

    window.history.pushState({}, "", url + location.hash);
    handleLocation(false);
}


/**
 * Router engine — detects which page to load
 */
export function handleLocation(reverse) {
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

    currentRoute = availableRoutes.find(r => r.dest === dest);

    if (!currentRoute) return;

    if (pageContentLoadRequest != null) {
        pageContentLoadRequest.abort();
    }

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
 * Load HTML page
 */
function loadPage(containerSelector, pagePath, onSuccess) {
    const container = $(containerSelector);
    const page = pageContentCache[pagePath];

    if (page != null) {
        container.html(page);
        onSuccess();
        return null;
    }

    return $.ajax({
        url: pagePath,
        success: html => {
            pageContentCache[pagePath] = html;
            container.html(html);
            onSuccess();
        }
    });
}


/**
 * Page animation
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
            "z-index": currentPageZIndex
        })
        .transition({ x: currentPageLeftTo }, 325);

    $("#page-next")
        .css({
            display: "",
            transform: `translate(${nextPageLeftFrom}, 0px)`,
            "z-index": nextPageZIndex
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
 * Reset containers after animation
 */
function restorePagesInitialState() {
    const currentPage = $("#page-current");
    const nextPage = $("#page-next");

    currentPage
        .attr("id", "page-next")
        .css({ display: "none", "z-index": "1" })
        .empty();

    nextPage
        .attr("id", "page-current")
        .css({ display: "", transform: "", "z-index": "2" });
}


/**
 * Handle browser back button
 */
window.onpopstate = () => handleLocation(true);
