// frontend/js/pages/main.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getInfo, getCategories, getPopularMenu } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage, replaceShimmerContent } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

// ===== MAIN BUTTON ("MY CART") =====
function positionsLabel(n) {
  return n === 1 ? "1 POSITION" : `${n} POSITIONS`;
}
function refreshMB() {
  const n = Cart.getPortionCount ? Cart.getPortionCount() : 0;
  if (n > 0) {
    document.body.dataset.mainbutton = "cart"; // для персист-хука
    TelegramSDK.showMainButton(`MY CART · ${positionsLabel(n)}`, () => navigateTo("cart"));
  } else {
    document.body.dataset.mainbutton = "";
    TelegramSDK.hideMainButton();
  }
}

export default class MainPage extends Route {
  constructor() {
    super("root", "/pages/main.html");
  }

  async load(params) {
    console.log("[MainPage] load", params);
    TelegramSDK.expand();
    refreshMB();

    // Загружаем параллельно
    await Promise.allSettled([
      this.#loadInfo(),
      this.#loadCategories(),
      this.#loadPopular(),
    ]);

    // на всякий случай ещё раз (вдруг корзина обновилась)
    refreshMB();
  }

  // ------- Информация о кафе -------
  async #loadInfo() {
    try {
      const info = await getInfo();
      console.log("[MainPage] info", info);

      if (info?.coverImage) {
        loadImage($("#cafe-cover"), info.coverImage);
        $("#cafe-cover").removeClass("shimmer");
      }
      if (info?.logoImage) {
        loadImage($("#cafe-logo"), info.logoImage);
        $("#cafe-logo").removeClass("shimmer");
      }
      if (info?.name) $("#cafe-name").text(info.name).removeClass("shimmer");
      if (info?.kitchenCategories)
        $("#cafe-kitchen-categories").text(info.kitchenCategories).removeClass("shimmer");
      if (info?.rating) $("#cafe-rating").text(info.rating);
      if (info?.cookingTime) $("#cafe-cooking-time").text(info.cookingTime);
      if (info?.status) $("#cafe-status").text(info.status);

      $("#cafe-info").removeClass("shimmer");
      $(".cafe-parameters-container").removeClass("shimmer");
    } catch (e) {
      console.error("[MainPage] failed to load info", e);
    }
  }

  // ------- Категории -------
  async #loadCategories() {
    try {
      const categories = await getCategories();
      console.log("[MainPage] categories", categories);

      $("#cafe-section-categories-title").removeClass("shimmer");

      // убираем скелеты полностью, чтобы не перекрывали клики
      const $wrap = $("#cafe-categories");
      $wrap.empty().removeClass("shimmer");

      categories.forEach((category) => {
        const $tpl = $($("#cafe-category-template").html());
        $tpl.attr("id", category.id);
        $tpl.css("background-color", category.backgroundColor || "");
        $tpl.find("#cafe-category-name").text(category.name || "");
        if (category.icon) loadImage($tpl.find("#cafe-category-icon"), category.icon);

        const go = () => navigateTo("category", JSON.stringify({ id: category.id }));
        $tpl.on("click", go);
        $tpl.on("keydown", (e) => (e.key === "Enter" || e.key === " ") && go());

        $wrap.append($tpl);
      });
    } catch (e) {
      console.error("[MainPage] failed to load categories", e);
    }
  }

  // ------- Популярные блюда -------
  async #loadPopular() {
    try {
      const items = await getPopularMenu();
      console.log("[MainPage] popular", items);

      $("#cafe-section-popular-title").removeClass("shimmer");

      // убираем скелеты полностью, чтобы не перекрывали клики
      const $wrap = $("#cafe-popular");
      $wrap.empty().removeClass("shimmer");

      items.forEach((item) => {
        const $tpl = $($("#cafe-item-template").html());
        $tpl.find("#cafe-item-name").text(item.name || "");
        $tpl.find("#cafe-item-description").text(item.description || "");
        if (item.image) loadImage($tpl.find("#cafe-item-image"), item.image);

        const go = () => navigateTo("details", JSON.stringify({ id: item.id }));
        $tpl.on("click", go);
        $tpl.on("keydown", (e) => (e.key === "Enter" || e.key === " ") && go());

        $wrap.append($tpl);
      });
    } catch (e) {
      console.error("[MainPage] failed to load popular menu", e);
    }
  }
}