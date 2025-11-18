// frontend/js/pages/details.js

import { Route } from "../routing/route.js";
import { getMenuItem } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

export default class DetailsPage extends Route {
    constructor() {
        super("details", "/pages/details.html");
    }

    async load(params) {
        console.log("[DetailsPage] load", params);
        TelegramSDK.expand();

        let itemId = null;
        try {
            itemId = JSON.parse(params || "{}").id;
        } catch (e) {
            return console.error("[DetailsPage] parse error", e);
        }

        if (!itemId) return console.error("[DetailsPage] no itemId");

        try {
            const item = await getMenuItem(itemId);
            if (!item) return;

            this.#fillItem(item);

        } catch (e) {
            console.error("[DetailsPage] failed to load item", e);
        }
    }

    #fillItem(item) {

        loadImage($("#details-image"), item.image);
        $("#details-name").text(item.name);
        $("#details-description").text(item.description);

        $(".shimmer").removeClass("shimmer");

        // === ВАРИАНТЫ ===
        const container = $("#details-variants");
        container.empty();

        let quantity = 1;
        const updateQty = () => $("#details-quantity-value").text(quantity);
        updateQty();

        const templateHtml = $("#details-variant-template").html();

        (item.variants ?? []).forEach(variant => {
            const el = $(templateHtml);

            el.attr("id", variant.id);
            el.find("#details-variant-name").text(variant.name);
            el.find("#details-variant-cost").text(variant.cost);
            el.find("#details-variant-weight").text(variant.weight);

            el.on("click", () => {
                Cart.addItem(item, variant, quantity);
            });

            container.append(el);
        });

        // кнопки qty
        $("#details-quantity-increase-button")
            .off("click")
            .on("click", () => {
                quantity++;
                updateQty();
            });

        $("#details-quantity-decrease-button")
            .off("click")
            .on("click", () => {
                if (quantity > 1) quantity--;
                updateQty();
            });
    }
}
