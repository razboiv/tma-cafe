// frontend/js/pages/details.js

import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuItem } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage } from "../utils/dom.js";
import Cart from "../cart/cart.js";

/**
 * Страница деталей блюда: большая фотка, описание, варианты и количество.
 */
export default class DetailsPage extends Route {
  constructor() {
    super("details", "/pages/details.html");
  }

  async load(params) {
    console.log("[DetailsPage] load", params);
    TelegramSDK.expand();

    // достаём id товара из params
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
    // --- Основная информация ---
    loadImage($("#details-image"), item.image);
    $("#details-name").text(item.name || "");
    $("#details-description").text(item.description || "");

    // убираем скелет-анимацию
    $("#details-image").removeClass("shimmer");
    $("#details-name").removeClass("shimmer");
    $("#details-description").removeClass("shimmer");
    $("#details-selected-variant-weight").removeClass("shimmer");
    $("#details-section-title").removeClass("shimmer");
    $("#details-variants").removeClass("shimmer");

    // --- Варианты блюда ---
    const variantsContainer = $("#details-variants");
    variantsContainer.empty();

    let quantity = 1;
    const updateQty = () => {
      $("#details-quantity-value").text(quantity);
    };
    updateQty();

    const templateHtml = $("#details-variant-template").html();

    (item.variants || []).forEach((variant) => {
      const el = $(templateHtml);

      el.attr("id", variant.id);
      el.find("#details-variant-name").text(variant.name || "");
      el.find("#details-variant-cost").text(variant.cost || "");
      el.find("#details-variant-weight").text(variant.weight || "");

      // добавление в корзину — ВАЖНО: используем addItem, а не add
      el.on("click", () => {
        Cart.addItem(item, variant, quantity);
      });

      variantsContainer.append(el);
    });

    // --- Кнопки +/- для количества ---
    $("#details-quantity-increase-button")
      .off("click")
      .on("click", () => {
        quantity += 1;
        updateQty();
      });

    $("#details-quantity-decrease-button")
      .off("click")
      .on("click", () => {
        if (quantity > 1) {
          quantity -= 1;
          updateQty();
        }
      });
  }
}
