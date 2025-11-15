// frontend/js/pages/category.js

import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuCategory } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { replaceShimmerContent } from "../utils/dom.js";
import Cart from "../cart/cart.js";

/**
 * Страница категории: список блюд одной категории.
 */
export default class CategoryPage extends Route {
  constructor() {
    super("category", "/pages/category.html");
  }

  async load(params) {
    console.log("[CategoryPage] load", params);
    TelegramSDK.expand();

    // основная кнопка
    const portionCount = Cart.getPortionCount();
    if (portionCount > 0) {
      TelegramSDK.showMainButton(
        `MY CART · ${this.#getDisplayPositionCount(portionCount)}`,
        () => navigateTo("cart")
      );
    } else {
      TelegramSDK.hideMainButton();
    }

    // читаем id категории из params
    let categoryId = null;
    try {
      const parsed = JSON.parse(params || "{}");
      categoryId = parsed.id;
    } catch (e) {
      console.error("[CategoryPage] failed to parse params", e);
    }

    if (!categoryId) {
      console.error("[CategoryPage] no categoryId in params");
      return;
    }

    // грузим меню для категории
    try {
      const menu = await getMenuCategory(categoryId);
      console.log("[CategoryPage] menu loaded", menu);
      this.#fillMenu(menu);
    } catch (err) {
      console.error("[CategoryPage] failed to load menu", err);
    }
  }

  #fillMenu(menuItems) {
    replaceShimmerContent(
      "#cafe-category",
      "#cafe-item-template",
      ".cafe-item-image",
      menuItems,
      (template, item) => {
        // название и описание
        template.find(".cafe-item-name").text(item.name || "");
        template
          .find(".cafe-item-description")
          .text(item.description || "");

        // картинка
        const imageEl = template.find(".cafe-item-image");
        if (item.imageUrl) {
          imageEl.attr("src", item.imageUrl);
          imageEl.removeClass("shimmer");
        } else {
          imageEl.attr("src", "icons/icon-transparent.svg");
        }

        // переход на details
        template.on("click", () => {
          const params = JSON.stringify({ id: item.id });
          navigateTo("details", params);
        });
      }
    );
  }

  #getDisplayPositionCount(count) {
    return count === 1 ? `${count} POSITION` : `${count} POSITIONS`;
  }
}
