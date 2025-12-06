// frontend/js/pages/category.js

import Route from "../routing/route.js";
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

    // 1) Главная кнопка
    this.updateMainButton();

    // 2) Валидируем параметры
    const categoryId = params && typeof params === "object" ? params.id : null;
    if (!categoryId) {
      console.error("[CategoryPage] no valid id in params:", params);
      return;
    }

    // 3) Грузим блюда категории
    const list = await getMenuCategory(categoryId);
    // ожидаем, что category.html содержит контейнер с id="category-list"
    const html = (list || []).map(item => {
      return `
        <div class="menu-card" data-item-id="${item.id}">
          <div class="menu-card__cover">
            <img src="${item.photo || ''}" alt="">
          </div>
          <div class="menu-card__title">${item.name || ""}</div>
          <div class="menu-card__subtitle">${item.short || ""}</div>
        </div>
      `;
    }).join("");

    replaceShimmerContent("#category-list", html);

    // 4) Навигация в карточку товара
    document.querySelectorAll('[data-item-id]').forEach($el => {
      $el.addEventListener("click", () => {
        const id = $el.getAttribute("data-item-id");
        if (id) navigateTo("details", { id });
      });
    });
  }

  updateMainButton() {
    const count = Cart.getPortionCount ? Cart.getPortionCount() : 0;
    if (count > 0) {
      TelegramSDK.showMainButton(
        `MY CART · ${count} POSITIONS`,
        () => navigateTo("cart"),
      );
      document.body.dataset.mainbutton = "cart";
    } else {
      TelegramSDK.hideMainButton();
      document.body.dataset.mainbutton = "";
    }
  }
}