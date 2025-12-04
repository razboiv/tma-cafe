// frontend/js/pages/main.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getInfo, getCategories, getPopularMenu } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

// ===== MainButton =====
function positionsLabel(n) { return n === 1 ? "1 POSITION" : `${n} POSITIONS`; }
function refreshMB() {
  const n = Cart.getPortionCount ? Cart.getPortionCount() : 0;
  if (n > 0) {
    document.body.dataset.mainbutton = "cart";
    TelegramSDK.showMainButton(`MY CART · ${positionsLabel(n)}`, () => navigateTo("cart"));
  } else {
    document.body.dataset.mainbutton = "";
    TelegramSDK.hideMainButton();
  }
}

// ===== Надёжная навигация =====
function goDetailsById(id) {
  // 1) пробуем роутер
  if (typeof navigateTo === "function") {
    // передаём объект — твой details.js умеет это распарсить
    try { return navigateTo("details", JSON.stringify({ id })); } catch {}
    try { return navigateTo("details", { id }); } catch {}
  }
  // 2) фолбэк: изменяем hash вручную (details.js умеет читать JSON в пути)
  const json = encodeURIComponent(JSON.stringify({ id }));
  const hash = `#/details/${json}`;
  location.hash = hash;
  if (window.handleLocation) window.handleLocation();
}

function goCategoryById(id) {
  if (typeof navigateTo === "function") {
    try { return navigateTo("category", JSON.stringify({ id })); } catch {}
    try { return navigateTo("category", { id }); } catch {}
  }
  const json = encodeURIComponent(JSON.stringify({ id }));
  const hash = `#/category/${json}`;
  location.hash = hash;
  if (window.handleLocation) window.handleLocation();
}

export default class MainPage extends Route {
  constructor() { super("root", "/pages/main.html"); }

  async load() {
    console.log("[MainPage] load");
    TelegramSDK.expand?.();
    refreshMB();

    await Promise.allSettled([
      this.#loadInfo(),
      this.#loadCategories(),
      this.#loadPopular(),
    ]);

    refreshMB();

    // Доп. защита: делегированный обработчик кликов по карточкам
    this.#attachDelegatedClicks();
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
      $("#cafe-info").removeClass("shimmer");
      $(".cafe-parameters-container").removeClass("shimmer");
    } catch (e) {
      console.error("[MainPage] info error", e);
    }
  }

  // ---------- Categories ----------
  async #loadCategories() {
    try {
      const categories = await getCategories();
      $("#cafe-section-categories-title").removeClass("shimmer");
      const $wrap = $("#cafe-categories");
      $wrap.empty().removeClass("shimmer");

      categories.forEach((c) => {
        const $tpl = $($("#cafe-category-template").html());
        $tpl.attr("data-id", c.id);
        $tpl.css("background-color", c.backgroundColor || "");
        $tpl.find(".cafe-category-name").text(c.name || "");
        if (c.icon) loadImage($tpl.find(".cafe-category-icon"), c.icon);

        // делаем ссылку «самодостаточной»
        const href = `#/category/${encodeURIComponent(JSON.stringify({ id: c.id }))}`;
        $tpl.attr("href", href);
        $tpl.on("click", (e) => { e.preventDefault(); goCategoryById(c.id); });
        $tpl.on("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goCategoryById(c.id); } });

        $wrap.append($tpl);
      });
    } catch (e) {
      console.error("[MainPage] categories error", e);
    }
  }

  // ---------- Popular ----------
  async #loadPopular() {
    try {
      const items = await getPopularMenu();
      $("#cafe-section-popular-title").removeClass("shimmer");
      const $wrap = $("#cafe-popular");
      $wrap.empty().removeClass("shimmer");

      items.forEach((it) => {
        const $tpl = $($("#cafe-item-template").html());
        $tpl.attr("data-id", it.id);
        $tpl.find(".cafe-item-name").text(it.name || "");
        $tpl.find(".cafe-item-description").text(it.description || "");
        if (it.image) loadImage($tpl.find(".cafe-item-image"), it.image);

        const href = `#/details/${encodeURIComponent(JSON.stringify({ id: it.id }))}`;
        $tpl.attr("href", href);
        $tpl.on("click", (e) => { e.preventDefault(); goDetailsById(it.id); });
        $tpl.on("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goDetailsById(it.id); } });

        $wrap.append($tpl);
      });
    } catch (e) {
      console.error("[MainPage] popular error", e);
    }
  }

  // ---------- Delegated fallback ----------
  #attachDelegatedClicks() {
    const root = document.getElementById("content") || document.body;
    if (!root) return;

    if (root.__onCardClick) {
      root.removeEventListener("click", root.__onCardClick);
    }

    root.__onCardClick = (e) => {
      const a = e.target.closest(".cafe-item-container[data-id], .cafe-category-container[data-id]");
      if (!a) return;
      const id = a.getAttribute("data-id");
      if (!id) return;

      e.preventDefault();
      if (a.classList.contains("cafe-item-container")) goDetailsById(id);
      else goCategoryById(id);
    };

    root.addEventListener("click", root.__onCardClick, { passive: false });
  }
}