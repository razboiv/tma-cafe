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

    // основной MainButton
    const count = Cart.getPortionCount();
    if (count > 0) {
      TelegramSDK.showMainButton(`MY CART · ${count} POSITIONS`, () => navigateTo("cart"));
    } else {
      TelegramSDK.hideMainButton();
    }

    // --- парсим id категории из params (строка/объект) ---
    let categoryId = null;
    try {
      if (typeof params === "string") {
        const p = JSON.parse(params || "{}");
        categoryId = p.id || p.categoryId || null;
      } else if (params && typeof params === "object") {
        categoryId = params.id || params.categoryId || null;
      }
    } catch (e) {
      console.error("[CategoryPage] parse params error:", e);
    }

    if (!categoryId) {
      console.warn("[CategoryPage] no category id in params:", params);
      navigateTo("root");
      return;
    }

    // --- грузим блюда и рендерим ---
    try {
      const items = await getMenuCategory(categoryId);

      const list =
        document.querySelector('[data-role="category-list"]') ||
        document.getElementById("category-list");

      if (list && Array.isArray(items)) {
        replaceShimmerContent(
          list,
          items
            .map(
              (m) => `
              <article class="menu-card" data-id="${m.id}">
                <img class="menu-card__img" src="${m.photo}" alt="${m.name}">
                <h3 class="menu-card__title">${m.name}</h3>
                <p class="menu-card__desc">${m.description || ""}</p>
              </article>`
            )
            .join("")
        );

        list.addEventListener(
          "click",
          (ev) => {
            const card = ev.target.closest("[data-id]");
            if (card) navigateTo("details", { id: card.getAttribute("data-id") });
          },
          { once: true }
        );
      }
    } catch (e) {
      console.error("[CategoryPage] load error:", e);
    }
  }
}