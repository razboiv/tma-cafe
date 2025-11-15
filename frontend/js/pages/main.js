// frontend/js/pages/main.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import {
  getInfo,
  getCategories,
  getPopularMenu,
} from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage, replaceShimmerContent } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

/**
 * Главная страница: инфо о кафе, категории, популярное меню.
 */
export default class MainPage extends Route {
  constructor() {
    super("root", "/pages/main.html");
  }

  async load(params) {
    console.log("[MainPage] load", params);
    TelegramSDK.expand();

    // основная кнопка
    const portionCount = Cart.getPortionCount();
    if (portionCount > 0) {
      TelegramSDK.showMainButton(
        `MY CART · ${this.#getDisplayPositionCount(portionCount)}`,
        () => navigateTo("cart"),
      );
    } else {
      TelegramSDK.hideMainButton();
    }

    // параллельно грузим всё с бэка
    await Promise.allSettled([
      this.#loadCafeInfo(),
      this.#loadCategories(),
      this.#loadPopularMenu(),
    ]);
  }

  async #loadCafeInfo() {
    try {
      const info = await getInfo();
      console.log("[MainPage] info", info);

      if (info?.title) {
        $("#cafe-name").text(info.title);
      }
      if (info?.description) {
        $("#cafe-description").text(info.description);
      }
      if (info?.coverImage) {
        // если в бэке поле называется иначе — подправь здесь
        loadImage($("#cafe-cover"), info.coverImage);
      }
      if (info?.kitchenCategories) {
        $("#cafe-kitchen-categories").text(info.kitchenCategories);
      }
      if (info?.cookingTime) {
        $("#cafe-cooking-time").text(info.cookingTime);
      }
      if (info?.status) {
        $("#cafe-status").text(info.status);
      }
    } catch (e) {
      console.error("[MainPage] failed to load info", e);
    }
  }

  async #loadCategories() {
    try {
      const categories = await getCategories();
      console.log("[MainPage] categories", categories);

      replaceShimmerContent(
        "#cafe-categories",
        "#cafe-category-template",
        "#cafe-category-icon",
        categories,
        (template, category) => {
          template.find("#cafe-category-name").text(category.name ?? "");

          const img = template.find("#cafe-category-icon");
          if (category.imageUrl) {
            loadImage(img, category.imageUrl);
          }

          template.on("click", () => {
            const params = JSON.stringify({ id: category.id });
            navigateTo("category", params);
          });
        },
      );
    } catch (e) {
      console.error("[MainPage] failed to load categories", e);
    }
  }

  async #loadPopularMenu() {
    try {
      const items = await getPopularMenu();
      console.log("[MainPage] popular", items);

      replaceShimmerContent(
        "#cafe-popular",
        "#cafe-item-template",
        "#cafe-item-image",
        items,
        (template, item) => {
          template.find("#cafe-item-name").text(item.name ?? "");
          template
            .find("#cafe-item-description")
            .text(item.description ?? "");

          const img = template.find("#cafe-item-image");
          if (item.imageUrl) {
            loadImage(img, item.imageUrl);
          }

          template.on("click", () => {
            const params = JSON.stringify({ id: item.id });
            navigateTo("details", params);
          });
        },
      );
    } catch (e) {
      console.error("[MainPage] failed to load popular menu", e);
    }
  }

  #getDisplayPositionCount(count) {
    return count === 1 ? `${count} POSITION` : `${count} POSITIONS`;
  }
}
