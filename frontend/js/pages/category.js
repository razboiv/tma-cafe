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

    // 1) распарсим параметры (строка/объект), поддержим id | categoryId | slug
    let p = {};
    try {
      p =
        typeof params === "string"
          ? JSON.parse(params || "{}")
          : params || {};
    } catch (_) {
      p = params || {};
    }
    const categoryId = p.categoryId || p.id || p.slug;

    if (!categoryId || typeof categoryId !== "string") {
      console.error("[CategoryPage] no valid id in params:", params);
      navigateTo("root");
      return;
    }

    // 2) загрузим блюда категории
    const items = await getMenuCategory(categoryId);
    console.log("[CategoryPage] items", items);

    // 3) отрисуем карточки через replaceShimmerContent
    //    (контейнер, <template>, селектор картинки, массив, заполнитель)
    replaceShimmerContent(
      "#cafe-category",
      "#cafe-item-template",
      "#cafe-item-image",
      Array.isArray(items) ? items : [],
      (template, item) => {
        // у нас в данных поле картинки может называться image (из оригинала) или photo
        const imageUrl = item.image || item.photo || "";
        if (imageUrl) {
          template.find("#cafe-item-image").attr("src", imageUrl);
        }
        template.find("#cafe-item-name").text(item.name || "");
        // подпись: из данных это либо description (оригинал), либо short (ваш вариант)
        template
          .find("#cafe-item-description")
          .text(item.description || item.short || "");

        // переход на детали
        template.on("click", () =>
          navigateTo("details", {
            id: String(item.id),
            categoryId, // пробрасываем текущую категорию
          })
        );
      }
    );
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