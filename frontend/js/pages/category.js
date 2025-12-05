// frontend/js/pages/category.js

import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuCategory } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { replaceShimmerContent } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

/**
 * Страница категории: список блюд из выбранной категории.
 */
export default class CategoryPage extends Route {
  constructor() {
    super("category", "/pages/category.html");
  }

  async load(params) {
    console.log("[CategoryPage] load", params);
    TelegramSDK.expand();

    // Показ / скрытие основной кнопки внизу
    const portionCount = Cart.getPortionCount();
    if (portionCount > 0) {
      TelegramSDK.showMainButton(
        `MY CART · ${portionCount} POSITION${portionCount === 1 ? "" : "S"}`,
        () => navigateTo("cart"),
      );
    } else {
      TelegramSDK.hideMainButton();
    }

    // Нормализуем params
    let p = params;
    if (typeof p === "string") {
      try { p = JSON.parse(p); } catch { p = {}; }
    }
    p = p || {};

    // Принимаем несколько возможных ключей
    const categoryId = p.categoryId || p.id || p.slug;
    if (!categoryId) {
      console.warn("[CategoryPage] no categoryId in params", p);
      return;
    }

    // Загружаем блюда категории
    try {
      const menu = await getMenuCategory(categoryId);
      console.log("[CategoryPage] menu loaded", menu);
      this.#fillMenu(menu, categoryId);
    } catch (err) {
      console.error("[CategoryPage] failed to load menu", err);
    }
  }

  // Заполняем список карточек
  #fillMenu(menuItems, categoryId) {
    replaceShimmerContent(
      "#cafe-category",
      "#cafe-item-template",
      ".cafe-item-image",
      menuItems,
      (template, item) => {
        // Тексты
        template.find(".cafe-item-name").text(item.name ?? "");
        template.find(".cafe-item-description").text(item.description ?? "");

        // Картинка
        const imgEl = template.find(".cafe-item-image");
        const imageUrl = item.imageUrl || item.image;
        if (imageUrl) {
          imgEl.attr("src", imageUrl);
          imgEl.removeClass("shimmer");
        } else {
          imgEl.attr("src", "icons/icon-transparent.svg");
        }

        // Переход на детали товара (передаём id и categoryId)
        template.on("click", () => {
          const nextParams = JSON.stringify({
            id: item.id,
            categoryId,
          });
          navigateTo("details", nextParams);
        });
      }
    );
  }
}