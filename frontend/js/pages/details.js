// frontend/js/pages/details.js

import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuItem } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";
import { toDisplayCost } from "../utils/currency.js";

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

// достаём id товара и id категории из params
let itemId = null;
let categoryId = null;

try {
  const parsed = JSON.parse(params || "{}");
  itemId = parsed.id;
  categoryId = parsed.categoryId;
} catch (e) {
  console.error("[DetailsPage] failed to parse params", e);
}

if (!itemId) {
  console.error("[DetailsPage] no itemId");
  return;
}

// сохраняем categoryId в this, чтобы использовать при возврате
this.categoryId = categoryId;

  // сохраним параметры категории, чтобы потом вернуться
  this.categoryParams = categoryId
    ? JSON.stringify({ id: categoryId })
    : null;

    // грузим товар
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
    // --- основная информация ---
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
    $("#details-price-value").removeClass("shimmer");

    const variantsContainer = $("#details-variants");
    variantsContainer.empty();

    // состояние
    let quantity = 1;
    let selectedVariant = (item.variants || [])[0] ?? null;

    const updateQty = () => {
      $("#details-quantity-value").text(quantity);
    };

    const updateSelected = () => {
      if (!selectedVariant) return;

      // вес выбранного варианта под названием
      $("#details-selected-variant-weight").text(
        selectedVariant.weight || ""
      );

      // цена выбранного варианта справа от Price
      $("#details-price-value").text(
        toDisplayCost(Number(selectedVariant.cost) || 0)
      );
    };

    updateQty();
    updateSelected();

    const templateHtml = $("#details-variant-template").html();

    (item.variants || []).forEach((variant) => {
      const el = $(templateHtml);

      // наполняем текстом
      el.attr("data-id", variant.id);
      el.find(".details-variant-name").text(variant.name || "");

     
      // обработчик выбора варианта
      el.on("click", () => {
        selectedVariant = variant;
        updateSelected();

        // визуально подсветить active (тумблер)
        $("#details-variants .cafe-item-details-variant").removeClass("active");
        el.addClass("active");
      });

      variantsContainer.append(el);
    });

    // по умолчанию выделяем первый вариант, если есть
    const firstBtn = $("#details-variants .cafe-item-details-variant").first();
    if (firstBtn.length) {
      firstBtn.addClass("active");
    }

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

    // Добавление в корзину при нажатии main-button
TelegramSDK.showMainButton("ADD TO CART", () => {
  if (!selectedVariant) return;
  Cart.addItem(item, selectedVariant, quantity);

});

  }
}
