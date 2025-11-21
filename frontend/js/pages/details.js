import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuItem } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";
import { toDisplayCost } from "../utils/currency.js";

export default class DetailsPage extends Route {
    constructor() {
        super("details", "/pages/details.html");
    }

    async load(params) {
        TelegramSDK.expand();

        let itemId = null;
        try {
            const parsed = JSON.parse(params || "{}");
            itemId = parsed.id;
        } catch (e) {
            console.error("[DetailsPage] failed to parse params", e);
        }

        if (!itemId) {
            console.error("[DetailsPage] no itemId");
            return;
        }

        try {
            const item = await getMenuItem(itemId);
            if (!item) {
                console.error("[DetailsPage] item not found", itemId);
                return;
            }
            this.#fillItem(item);
        } catch (err) {
            console.error("[DetailsPage] failed to load item", err);
        }
    }

    #fillItem(item) {
        // === Основная инфа ================================
        loadImage($("#details-image"), item.image);
        $("#details-name").text(item.name || "");
        $("#details-description").text(item.description || "");

        $("#details-image").removeClass("shimmer");
        $("#details-name").removeClass("shimmer");
        $("#details-description").removeClass("shimmer");
        $("#details-selected-variant-weight").removeClass("shimmer");
        $("#details-section-title").removeClass("shimmer");
        $("#details-variants").removeClass("shimmer");
        $("#details-price-value").removeClass("shimmer");

        const variantsContainer = $("#details-variants");
        variantsContainer.empty();

        let quantity = 1;
        let selectedVariant = (item.variants || [])[0] ?? null;

        const updateQty = () => {
            $("#details-quantity-value").text(quantity);
        };

        const updateSelected = () => {
            if (!selectedVariant) return;

            $("#details-selected-variant-weight").text(selectedVariant.weight || "");
            $("#details-price-value").text(
                toDisplayCost(Number(selectedVariant.cost) || 0)
            );
        };

        updateQty();
        updateSelected();

        // === Сборка кнопок вариантов ============================
        const templateHtml = $("#details-variant-template").html();

        (item.variants || []).forEach((variant) => {
            const el = $(templateHtml);

            el.attr("data-id", variant.id);
            el.find(".details-variant-name").text(variant.name || "");
            el.find(".details-variant-cost").text(toDisplayCost(Number(variant.cost) || 0));
            el.find(".details-variant-weight").text(variant.weight || "");

            el.on("click", () => {
                selectedVariant = variant;

                $("#details-variants .cafe-item-details-variant").removeClass("active");
                el.addClass("active");

                updateSelected();
            });

            variantsContainer.append(el);
        });

        // выделяем первый вариант
        const firstBtn = $("#details-variants .cafe-item-details-variant").first();
        if (firstBtn.length) firstBtn.addClass("active");

        // === Кнопки количества ==================================
        $("#details-quantity-increase-button")
            .off("click")
            .on("click", () => {
                quantity += 1;
                updateQty();
            });

        $("#details-quantity-decrease-button")
            .off("click")
            .on("click", () => {
                if (quantity > 1) quantity -= 1;
                updateQty();
            });

        // === Добавление в корзину ===============================
        TelegramSDK.showMainButton("ADD TO CART", () => {
            if (!selectedVariant) return;

            Cart.addItem(item, selectedVariant, quantity);
            navigateTo("category");
        });
    }
}
