// frontend/js/pages/category.js

import Route from "../routing/route.js";
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

        // основная кнопка
        const portionCount = Cart.getPortionCount();
        if (portionCount > 0) {
            TelegramSDK.showMainButton(
                `MY CART · ${portionCount} POSITION${portionCount === 1 ? "" : "S"}`,
                () => navigateTo("cart"),
            );
        } else {
            TelegramSDK.hideMainButton();
        }

        // парсим id категории из params
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

        // грузим меню категории
        try {
            const menu = await getMenuCategory(categoryId);
            console.log("[CategoryPage] menu loaded", menu);
            this.#fillMenu(menu.items, categoryId); // передаём categoryId
        } catch (err) {
            console.error("[CategoryPage] failed to load menu", err);
        }
    }

    // приватный метод — ВНУТРИ класса
    #fillMenu(menuItems, categoryId) {
        replaceShimmerContent(
            "#cafe-category",
            "#cafe-item-template",
            ".cafe-item-image",
            menuItems,
            (template, item) => {
                // текст
                template.find(".cafe-item-name").text(item.name || "");
                template
                    .find(".cafe-item-description")
                    .text(item.description || "");

                // картинка
                const imageEl = template.find(".cafe-item-image");
                const imageUrl = item.imageUrl || item.image;
                if (imageUrl) {
                    imageEl.attr("src", imageUrl);
                    imageEl.removeClass("shimmer");
                } else {
                    imageEl.attr("src", "icons/icon-transparent.svg");
                }

                // переход на details с id и categoryId
                template.on("click", () => {
                    const params = JSON.stringify({
                        id: item.id,
                        categoryId: categoryId,
                    });
                    navigateTo("details", params);
                });
            }
        );
    }
}
