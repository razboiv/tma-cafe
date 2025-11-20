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

    // ===== основная кнопка (MY CART …) =====
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

  // ===== инфо о кафе =====
  async #loadCafeInfo() {
    try {
      const info = await getInfo();
      console.log("[MainPage] info", info);

      // картинка-обложка
      if (info?.coverImage) {
        loadImage($("#cafe-cover"), info.coverImage);
        $("#cafe-cover").removeClass("shimmer");
      }

      // логотип (круглый значок справа)
      if (info?.logoImage) {
        loadImage($("#cafe-logo"), info.logoImage);
        $("#cafe-logo").removeClass("shimmer");
      }

      // название
      if (info?.name) {
        $("#cafe-name").text(info.name);
      }

      // подпись под названием – берём kitchenCategories
      if (info?.kitchenCategories) {
        $("#cafe-kitchen-categories").text(info.kitchenCategories);
      }

      // рейтинг
      if (info?.rating) {
        $("#cafe-rating").text(info.rating);
      }

      // время доставки
      if (info?.cookingTime) {
        $("#cafe-cooking-time").text(info.cookingTime);
      }

      // статус (Open / Closed)
      if (info?.status) {
        $("#cafe-status").text(info.status);
      }

      // убираем скелет-анимацию у блока инфы
      $("#cafe-info").removeClass("shimmer");
      $("#cafe-name").removeClass("shimmer");
      $("#cafe-kitchen-categories").removeClass("shimmer");
      $(".cafe-parameters-container").removeClass("shimmer");
    } catch (e) {
      console.error("[MainPage] failed to load info", e);
    }
  }

  // ===== категории =====
  async #loadCategories() {
    try {
      const categories = await getCategories();
      console.log("[MainPage] categories", categories);

      // снимаем shimmer с заголовка
      $("#cafe-section-categories-title").removeClass("shimmer");

      replaceShimmerContent(
        "#cafe-categories",       // контейнер
        "#cafe-category-template",// <template>
        "#cafe-category-icon",    // картинка внутри шаблона
        categories,
        (template, category) => {
          template.attr("id", category.id);
          template.css("background-color", category.backgroundColor || "");
          template.find("#cafe-category-name").text(category.name ?? "");

          const img = template.find("#cafe-category-icon");
          if (category.icon) {
            loadImage(img, category.icon);
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

  // ===== популярное меню =====
  async #loadPopularMenu() {
    try {
      const items = await getPopularMenu();
      console.log("[MainPage] popular", items);

      // снимаем shimmer с заголовка
      $("#cafe-section-popular-title").removeClass("shimmer");

      replaceShimmerContent(
        "#cafe-popular",      // контейнер
        "#cafe-item-template",// <template>
        "#cafe-item-image",   // картинка внутри шаблона
        items,
        (template, item) => {
          template.find("#cafe-item-name").text(item.name ?? "");
          template
            .find("#cafe-item-description")
            .text(item.description ?? "");

          const img = template.find("#cafe-item-image");
          if (item.image) {
            loadImage(img, item.image);
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
