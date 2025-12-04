// frontend/js/pages/details.js

import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { get } from "../requests/requests.js";
import { TelegramSDK } from "../telegram/telegram.js";
import { loadImage } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";
import { toDisplayCost } from "../utils/currency.js";

export class DetailsPage extends Route {
  #item = null;
  #variant = null;
  #qty = 1;

  constructor() {
    super("details", "/pages/details.html");
  }

  load(params) {
    // Мы на странице товара — показываем режим "добавления" для персист-хука
    document.body.dataset.mainbutton = "add";
    TelegramSDK.showMainButton("ADD TO CART", () => this.#onAdd());

    // начальное состояние
    this.#qty = 1;

    // подгружаем данные товара
    const id = params?.id;
    if (!id) return;

    get(`/menu/details/${id}`, (item) => {
      this.#item = item || null;
      if (!this.#item) return;

      this.#renderItem(this.#item);
      this.#bindQuantityControls();
      this.#buildVariants(this.#item.variants || []);
    });
  }

  onClose() {
    // при уходе со страницы товара — выключаем режим
    document.body.dataset.mainbutton = "";
  }

  // ====== UI ======

  #renderItem(item) {
    // Картинка
    const $img = $("#cafe-item-details-image");
    if ($img.length) {
      loadImage(item.image, $img);
      $img.removeClass("shimmer");
    }

    // Название
    $("#cafe-item-details-name").text(item.name || "").removeClass("shimmer");

    // Описание
    $("#cafe-item-details-description")
      .text(item.description || "")
      .removeClass("shimmer");

    // Заголовок секции "Price"
    $("#cafe-item-details-section-title").text("Price").removeClass("shimmer");

    // Кол-во
    $("#cafe-item-details-quantity-value").text(this.#qty);

    // По умолчанию берём первый вариант (если есть)
    if (Array.isArray(item.variants) && item.variants.length) {
      this.#selectVariant(item.variants[0]);
    }
  }

  #buildVariants(variants) {
    const $container = $("#cafe-item-details-variants");
    const tmpl = $("#cafe-item-details-variant-template").html() || "<button class=\"cafe-item-details-variant\"></button>";
    $container.empty();

    variants.forEach((v) => {
      const $btn = $(tmpl);
      $btn.text(v.name || "");
      $btn.on("click", () => {
        this.#selectVariant(v);

        // Подсветка активного
        $container.find(".cafe-item-details-variant").removeClass("active");
        $btn.addClass("active");
      });
      $container.append($btn);
    });

    // снять шимер
    $container.removeClass("shimmer");
  }

  #selectVariant(v) {
    this.#variant = v;

    // Цена и вес
    const price = toDisplayCost(parseInt(v?.cost ?? "0", 10));
    $("#cafe-item-details-selected-variant-price")
      .text(price)
      .removeClass("shimmer");

    $("#cafe-item-details-selected-variant-weight")
      .text(v?.weight || "")
      .removeClass("shimmer");
  }

  #bindQuantityControls() {
    $("#cafe-item-details-quantity-increase-button").on("click", () => {
      this.#qty = Math.min(99, this.#qty + 1);
      $("#cafe-item-details-quantity-value").text(this.#qty);
    });

    $("#cafe-item-details-quantity-decrease-button").on("click", () => {
      this.#qty = Math.max(1, this.#qty - 1);
      $("#cafe-item-details-quantity-value").text(this.#qty);
    });
  }

  // ====== Actions ======

  #onAdd() {
    if (!this.#item || !this.#variant) return;

    // Добавляем в корзину (без перехода)
    Cart.addItem(this.#item, this.#variant, this.#qty);

    // Меняем режим: теперь главная кнопка — открыть корзину
    document.body.dataset.mainbutton = "cart";

    const count = Cart.getPortionCount();
    const label = count === 1 ? "MY CART · 1 POSITION" : `MY CART · ${count} POSITIONS`;

    TelegramSDK.showMainButton(label, () => navigateTo("cart"));
  }
}
