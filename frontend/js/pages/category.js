// frontend/js/pages/category.js

import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuCategory } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { replaceShimmerContent } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

/**
 * Страница категории: список блюд из выбранной категории.
 * Разметка из /frontend/pages/category.html:
 *  - контейнер:   #cafe-category
 *  - <template>:  #cafe-item-template
 *  - картинка:    #cafe-item-image
 */
export default class CategoryPage extends Route {
  constructor() {
    super("category", "/pages/category.html");
  }

  async load(params) {
    // Кнопка «Назад» — всегда на главную
    TelegramSDK.showBackButton(() => navigateTo("root"));

    // Счётчик корзины в главной кнопке
    const count = this.#cartCount();
    if (count > 0) {
      TelegramSDK.showMainButton(
        `MY CART · ${this.#formatPositions(count)}`,
        () => navigateTo("cart")
      );
    } else {
      TelegramSDK.hideMainButton();
    }

    // Загрузка меню выбранной категории
    try {
      const categoryId = params ? JSON.parse(params).id : null;
      if (!categoryId) {
        console.error("[CategoryPage] categoryId is empty in params:", params);
        return;
      }
      const items = await getMenuCategory(categoryId);
      this.#fillMenu(items, categoryId);
    } catch (e) {
      console.error("[CategoryPage] failed to load category menu:", e);
    }
  }

  // Кол-во позиций в корзине
  #cartCount() {
    try {
      const items = (Cart.getItems && Cart.getItems()) || [];
      return items.reduce((s, it) => s + Number(it.quantity || it.count || 0), 0);
    } catch { return 0; }
  }

  // Рендер карточек: меняем shimmer на данные
  #fillMenu(items, categoryId) {
    replaceShimmerContent(
      "#cafe-category",        // контейнер
      "#cafe-item-template",   // <template>
      "#cafe-item-image",      // картинка внутри шаблона
      items,
      (template, item) => {
        template.find("#cafe-item-name").text(item.name ?? "");
        template.find("#cafe-item-description").text(item.description ?? "");
        const img = template.find("#cafe-item-image");
        if (img && item.image) img.attr("src", item.image);

        // переход на страницу товара
        template.on("click", () => {
          const p = JSON.stringify({ id: item.id, categoryId });
          navigateTo("details", p);
        });
      }
    );
  }

  #formatPositions(n) {
    return n === 1 ? `${n} POSITION` : `${n} POSITIONS`;
  }
}