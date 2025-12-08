// frontend/js/pages/category.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuCategory } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { replaceShimmerContent } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

export default class CategoryPage extends Route {
  constructor() {
    super("category", "/pages/category.html");
  }

  async load(params) {
    console.log("[CategoryPage] load", params);
    TelegramSDK.expand();
    this.updateMainButton();

    // --- 1) безопасно распарсим то, что пришло из роутера ---
    let p = {};
    try {
      p = typeof params === "string" ? JSON.parse(params || "{}") : (params || {});
    } catch (_) {
      p = params || {};
    }

    // --- 2) поддерживаем id / categoryId / slug ---
    const categoryId = p.categoryId || p.id || p.slug;

    // --- 3) валидация ---
    if (!categoryId || typeof categoryId !== "string") {
      console.error("[CategoryPage] no valid id in params:", params);
      navigateTo("root");
      return;
    }

    // --- 4) загрузка и рендер ---
    const items = await getMenuCategory(categoryId);
    const html = (items || [])
      .map(
        (i) => `
      <div class="menu-card" data-item-id="${i.id}">
        <div class="menu-card__cover"><img src="${i.photo || ""}" alt=""></div>
        <div class="menu-card__title">${i.name || ""}</div>
        <div class="menu-card__subtitle">${i.short || ""}</div>
      </div>`
      )
      .join("");
    replaceShimmerContent("#category-list", html);

    // --- 5) переход на детали, пробрасываем и categoryId ---
    document.querySelectorAll("[data-item-id]").forEach(($el) => {
      $el.addEventListener("click", () =>
        navigateTo("details", { id: $el.getAttribute("data-item-id"), categoryId })
      );
    });
  }

  updateMainButton() {
    const count = Cart.getPortionCount ? Cart.getPortionCount() : 0;
    if (count > 0) {
      TelegramSDK.showMainButton(`MY CART · ${count} POSITIONS`, () =>
        navigateTo("cart")
      );
      document.body.dataset.mainbutton = "cart";
    } else {
      TelegramSDK.hideMainButton();
      document.body.dataset.mainbutton = "";
    }
  }
}