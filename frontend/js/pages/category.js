// frontend/js/pages/category.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuCategory } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { replaceShimmerContent } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

export class CategoryPage extends Route {
  constructor() {
    super("category", "/pages/category.html");
  }

  async load(params) {
    console.log("[CategoryPage] load", params);
    TelegramSDK.expand();

    const portionCount = Cart.getPortionCount();
    if (portionCount > 0) {
      TelegramSDK.showMainButton(
        `MY CART • ${portionCount} POSITIONS`,
        () => navigateTo("cart")
      );
    } else {
      TelegramSDK.hideMainButton();
    }

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

    try {
      const items = await getMenuCategory(categoryId);
      this.#fillMenu(items);
    } catch (err) {
      console.error("[CategoryPage] failed to load menu", err);
    }
  }

  #fillMenu(items) {
    replaceShimmerContent(
      "#category-menu",
      "#category-item-template",
      "#category-item-image",
      items,
      (template, item) => {
        template.attr("id", item.id);
        template.find("#category-item-image").attr("src", item.image);
        template.find("#category-item-name").text(item.name);
        template
          .find("#category-item-description")
          .text(item.description);

        template.on("click", () => {
          const params = JSON.stringify({ id: item.id });
          navigateTo("details", params);
        });
      }
    );
  }
}
