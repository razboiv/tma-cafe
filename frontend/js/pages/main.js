// frontend/js/pages/main.js
import { Route } from "../routing/route.js";
import { getInfo, getCategories, getPopularMenu } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

// ---------- MainButton ----------
const positionsLabel = (n) => (n === 1 ? "1 POSITION" : `${n} POSITIONS`);
function refreshMB() {
  const n = Cart.getPortionCount ? Cart.getPortionCount() : 0;
  if (n > 0) {
    document.body.dataset.mainbutton = "cart";
    TelegramSDK.showMainButton(`MY CART · ${positionsLabel(n)}`, () => {
      location.hash = "#/cart";
      if (window.handleLocation) window.handleLocation();
    });
  } else {
    document.body.dataset.mainbutton = "";
    TelegramSDK.hideMainButton();
  }
}

// ---------- Надёжная навигация через hash ----------
function toDetails(id) {
  const json = encodeURIComponent(JSON.stringify({ id }));
  location.hash = `#/details/${json}`;
  if (window.handleLocation) window.handleLocation();
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
}

function toCategory(id) {
  const json = encodeURIComponent(JSON.stringify({ id }));
  location.hash = `#/category/${json}`;
  if (window.handleLocation) window.handleLocation();
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
}

// ---------- Класс страницы ----------
export default class MainPage extends Route {
  constructor() { super("root", "/pages/main.html"); }

  async load() {
    TelegramSDK.expand?.();
    refreshMB();

    await Promise.allSettled([
      this.#loadInfo(),
      this.#loadCategories(),
      this.#loadPopular(),
    ]);

    refreshMB();

    // Делегированный ловец тапа в capture-режиме (обходит любые оверлеи)
    const root = document.getElementById("content") || document.body;
    const handler = (e) => {
      const a = e.target.closest(".cafe-item-container[data-id], .cafe-category-container[data-id]");
      if (!a) return;
      const id = a.getAttribute("data-id");
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (a.classList.contains("cafe-item-container")) toDetails(id);
      else toCategory(id);
    };
    ["pointerup","touchend","click"].forEach(evt => {
      root.addEventListener(evt, handler, { capture: true, passive: false });
    });
  }

  // ---------- Info ----------
  async #loadInfo() {
    try {
      const info = await getInfo();
      if (info?.coverImage) { loadImage($("#cafe-cover"), info.coverImage); $("#cafe-cover").removeClass("shimmer"); }
      if (info?.logoImage)  { loadImage($("#cafe-logo"), info.logoImage);   $("#cafe-logo").removeClass("shimmer"); }
      if (info?.name) $("#cafe-name").text(info.name).removeClass("shimmer");
      if (info?.kitchenCategories) $("#cafe-kitchen-categories").text(info.kitchenCategories).removeClass("shimmer");
      if (info?.rating) $("#cafe-rating").text(info.rating);
      if (info?.cookingTime) $("#cafe-cooking-time").text(info.cookingTime);
      if (info?.status) $("#cafe-status").text(info.status);
      $("#cafe-info,.cafe-parameters-container").removeClass("shimmer");
    } catch(e){ console.error("[MainPage] info error", e); }
  }

  // ---------- Categories ----------
  async #loadCategories() {
    try {
      const list = await getCategories();
      $("#cafe-section-categories-title").removeClass("shimmer");
      const $wrap = $("#cafe-categories").empty().removeClass("shimmer");

      list.forEach(c => {
        const $a = $($("#cafe-category-template").html());
        $a.attr("data-id", c.id);
        $a.attr("href", `#/category/${encodeURIComponent(JSON.stringify({ id:c.id }))}`);
        if (c.backgroundColor) $a.css("background-color", c.backgroundColor);
        if (c.icon) $a.append(`<img class="cafe-category-icon" src="${c.icon}" alt="">`);
        $a.append(`<div class="cafe-category-name">${c.name ?? ""}</div>`);

        // локальный обработчик (вдобавок к делегированному)
        const go = (e)=>{ e.preventDefault(); toCategory(c.id); };
        ["pointerup","touchend","click"].forEach(evt => $a.on(evt, go));

        $wrap.append($a);
      });
    } catch(e){ console.error("[MainPage] categories error", e); }
  }

  // ---------- Popular ----------
  async #loadPopular() {
    try {
      const items = await getPopularMenu();
      $("#cafe-section-popular-title").removeClass("shimmer");
      const $wrap = $("#cafe-popular").empty().removeClass("shimmer");

      items.forEach(it => {
        const $a = $($("#cafe-item-template").html());
        $a.attr("data-id", it.id);
        $a.attr("href", `#/details/${encodeURIComponent(JSON.stringify({ id:it.id }))}`);
        if (it.image) $a.find(".cafe-item-image").attr("src", it.image);
        $a.find(".cafe-item-name").text(it.name ?? "");
        $a.find(".cafe-item-description").text(it.description ?? "");

        const go = (e)=>{ e.preventDefault(); toDetails(it.id); };
        ["pointerup","touchend","click"].forEach(evt => $a.on(evt, go));

        $wrap.append($a);
      });
    } catch(e){ console.error("[MainPage] popular error", e); }
  }
}