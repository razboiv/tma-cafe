// frontend/js/pages/main.js
import { Route } from "../routing/route.js";
import { getInfo, getCategories, getPopularMenu } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

/* ---------- MainButton ---------- */

const positionsLabel = (n) => (n === 1 ? "1 POSITION" : `${n} POSITIONS`);

function refreshMB() {
  const n = Cart.getPortionCount ? Cart.getPortionCount() : 0;
  if (n > 0) {
    document.body.dataset.mainbutton = "cart";
    TelegramSDK.showMainButton(`MY CART · ${positionsLabel(n)}`, () => {
      const target = "#/cart";
      if (location.hash !== target) location.hash = target;
      if (window.handleLocation) window.handleLocation();
    });
  } else {
    document.body.dataset.mainbutton = "";
    TelegramSDK.hideMainButton();
  }
}

/* ---------- Надёжная навигация (hash + анти-дубль) ---------- */

let navLock = false;
function safeNavigate(nextHash) {
  if (!nextHash) return;
  if (navLock) return;
  navLock = true;
  setTimeout(() => {
    if (location.hash !== nextHash) location.hash = nextHash;
    if (window.handleLocation) window.handleLocation();
    navLock = false;
  }, 0);
}

function toDetails(id) {
  const json = encodeURIComponent(JSON.stringify({ id }));
  safeNavigate(`#/details/${json}`);
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
}

function toCategory(id) {
  const json = encodeURIComponent(JSON.stringify({ id }));
  safeNavigate(`#/category/${json}`);
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
}

/* ---------- Страница ---------- */

export default class MainPage extends Route {
  constructor() {
    super("root", "/pages/main.html");
  }

  async load() {
    TelegramSDK.expand?.();
    refreshMB();

    await Promise.allSettled([
      this.#loadInfo(),
      this.#loadCategories(),
      this.#loadPopular(),
    ]);

    refreshMB();

    // Один делегированный обработчик кликов, capture = true, без дублей
    const root = document.getElementById("content") || document.body;
    const onTap = (e) => {
      const a = e.target.closest(".cafe-item-container[data-id], .cafe-category-container[data-id]");
      if (!a) return;

      const id = a.getAttribute("data-id");
      if (!id) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (a.classList.contains("cafe-item-container")) {
        toDetails(id);
      } else {
        toCategory(id);
      }
    };
    ["pointerup", "touchend", "click"].forEach((evt) =>
      root.addEventListener(evt, onTap, { capture: true, passive: false })
    );
  }

  /* ---------- Info ---------- */
  async #loadInfo() {
    try {
      const info = await getInfo();

      if (info?.coverImage) {
        loadImage($("#cafe-cover"), info.coverImage);
        $("#cafe-cover").removeClass("shimmer");
      }
      if (info?.logoImage) {
        loadImage($("#cafe-logo"), info.logoImage);
        $("#cafe-logo").removeClass("shimmer");
      }
      if (info?.name) $("#cafe-name").text(info.name).removeClass("shimmer");
      if (info?.kitchenCategories) $("#cafe-kitchen-categories").text(info.kitchenCategories).removeClass("shimmer");
      if (info?.rating) $("#cafe-rating").text(info.rating);
      if (info?.cookingTime) $("#cafe-cooking-time").text(info.cookingTime);
      if (info?.status) $("#cafe-status").text(info.status);

      $("#cafe-info,.cafe-parameters-container").removeClass("shimmer");
    } catch (e) {
      console.error("[MainPage] info error", e);
    }
  }

  /* ---------- Categories ---------- */
  async #loadCategories() {
    try {
      const list = await getCategories();
      $("#cafe-section-categories-title").removeClass("shimmer");

      const $wrap = $("#cafe-categories").empty().removeClass("shimmer");
      const tpl = document.getElementById("cafe-category-template");

      list.forEach((c) => {
        const $a = $(tpl.innerHTML);
        $a.attr("data-id", c.id);
        $a.attr("href", `#/category/${encodeURIComponent(JSON.stringify({ id: c.id }))}`);
        if (c.backgroundColor) $a.css("background-color", c.backgroundColor);
        if (c.icon) $a.append(`<img class="cafe-category-icon" src="${c.icon}" alt="">`);
        $a.append(`<div class="cafe-category-name">${c.name ?? ""}</div>`);
        $wrap.append($a);
      });
    } catch (e) {
      console.error("[MainPage] categories error", e);
    }
  }

  /* ---------- Popular ---------- */
  async #loadPopular() {
    try {
      const items = await getPopularMenu();
      $("#cafe-section-popular-title").removeClass("shimmer");

      const $wrap = $("#cafe-popular").empty().removeClass("shimmer");
      const tpl = document.getElementById("cafe-item-template");

      items.forEach((it) => {
        const $a = $(tpl.innerHTML);
        $a.attr("data-id", it.id);
        $a.attr("href", `#/details/${encodeURIComponent(JSON.stringify({ id: it.id }))}`);
        if (it.image) $a.find(".cafe-item-image").attr("src", it.image);
        $a.find(".cafe-item-name").text(it.name ?? "");
        $a.find(".cafe-item-description").text(it.description ?? "");
        $wrap.append($a);
      });
    } catch (e) {
      console.error("[MainPage] popular error", e);
    }
  }
}