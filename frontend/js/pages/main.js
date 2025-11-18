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
                () => navigateTo("cart")
            );
        } else {
            TelegramSDK.hideMainButton();
        }

        // грузим с бэка
        await Promise.allSettled([
            this.#loadCafeInfo(),
            this.#loadCategories(),
            this.#loadPopularMenu(),
        ]);
    }

    async #loadCafeInfo() {
        try {
            const info = await getInfo();

            if (info.title) $("#cafe-name").text(info.title);
            if (info.description) $("#cafe-description").text(info.description);
            if (info.coverImage) loadImage($("#cafe-cover"), info.coverImage);

            $("#cafe-info").removeClass("shimmer");

        } catch (e) {
            console.error("[MainPage] failed to load info", e);
        }
    }

    async #loadCategories() {
        try {
            const categories = await getCategories();
            $("#cafe-section-categories-title").removeClass("shimmer");

            replaceShimmerContent(
                "#cafe-categories",
                "#cafe-category-template",
                "#cafe-category-icon",
                categories,
                (template, category) => {
                    template.attr("id", category.id);
                    template.find("#cafe-category-name").text(category.name);
                    loadImage(template.find("#cafe-category-icon"), category.icon);

                    template.on("click", () => {
                        navigateTo("category", JSON.stringify({ id: category.id }));
                    });
                }
            );

        } catch (e) {
            console.error("[MainPage] failed to load categories", e);
        }
    }

    async #loadPopularMenu() {
        try {
            const items = await getPopularMenu();
            $("#cafe-section-popular-title").removeClass("shimmer");

            replaceShimmerContent(
                "#cafe-popular",
                "#cafe-item-template",
                "#cafe-item-image",
                items,
                (template, item) => {
                    template.find("#cafe-item-name").text(item.name);
                    template.find("#cafe-item-description").text(item.description);
                    loadImage(template.find("#cafe-item-image"), item.image);

                    template.on("click", () => {
                        navigateTo("details", JSON.stringify({ id: item.id }));
                    });
                }
            );

        } catch (e) {
            console.error("[MainPage] failed to load popular menu", e);
        }
    }

    #getDisplayPositionCount(count) {
        return count === 1 ? `${count} POSITION` : `${count} POSITIONS`;
    }
}
