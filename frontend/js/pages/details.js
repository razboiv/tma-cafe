// frontend/js/pages/details.js

import Route from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuItem } from "../requests/requests.js";        // функция должна вернуть товар по id
import TelegramSDK from "../telegram/telegram.js";
import { replaceShimmerContent } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

/**
 * Карточка товара: сначала кнопка "ADD TO CART".
 * После добавления — "MY CART · N POSITIONS".
 * Переход в корзину — только по нажатию на кнопку "MY CART".
 */
export default class DetailsPage extends Route {
  constructor() {
    super("details", "/pages/details.html");
    this.item = null;
    this.qty = 1;
    this.size = "small";
  }

  async load(params) {
    console.log("[Details] load", params);
    TelegramSDK.expand();

    const id = params && params.id ? params.id : null;
    if (!id) {
      console.error("[Details] no id in params:", params);
      return;
    }

    // 1) Грузим товар
    this.item = await getMenuItem(id);

    // 2) Рендерим разметку карточки (ожидается, что в details.html есть #details-root)
    replaceShimmerContent("#details-root", this.render());

    // 3) Привязываем события (размер/количество)
    this.bindControls();

    // 4) Показать кнопку "ADD TO CART"
    this.showAddButton();
  }

  render() {
    const p = (this.item?.portions || [])[0] || {};
    const price = p.price || this.item?.price || 0;
    const weight = p.weight || this.item?.weight || "";

    return `
      <div class="details__cover">
        <img src="${this.item?.photo || ""}" alt="">
      </div>

      <h1 class="details__title">${this.item?.name || ""}</h1>
      <div class="details__desc">${this.item?.description || ""}</div>

      <div class="details__price-row">
        <div class="details__price-label">Price</div>
        <div class="details__weight">${weight}</div>
      </div>

      <div class="details__size">
        <button class="size-btn is-active" data-size="small">Small</button>
        <button class="size-btn" data-size="large">Large</button>
      </div>

      <div class="details__price">
        $${price.toFixed ? price.toFixed(2) : price}
      </div>

      <div class="details__qty">
        <button class="qty-btn" data-act="dec">−</button>
        <span id="details-qty">1</span>
        <button class="qty-btn" data-act="inc">+</button>
      </div>
    `;
  }

  bindControls() {
    // выбор размера
    document.querySelectorAll(".size-btn").forEach($b => {
      $b.addEventListener("click", () => {
        document.querySelectorAll(".size-btn").forEach(x => x.classList.remove("is-active"));
        $b.classList.add("is-active");
        this.size = $b.dataset.size || "small";
      });
    });

    // количество
    const $qty = document.getElementById("details-qty");
    const clamp = (v) => Math.max(1, Math.min(50, v));

    document.querySelectorAll(".qty-btn").forEach($b => {
      $b.addEventListener("click", () => {
        const act = $b.dataset.act;
        this.qty = clamp(this.qty + (act === "inc" ? 1 : -1));
        if ($qty) $qty.textContent = String(this.qty);
      });
    });
  }

  showAddButton() {
    document.body.dataset.mainbutton = "add";
    TelegramSDK.showMainButton("ADD TO CART", () => this.handleAddToCart());
  }

  showCartButton() {
    const count = Cart.getPortionCount ? Cart.getPortionCount() : 0;
    document.body.dataset.mainbutton = "cart";
    TelegramSDK.showMainButton(
      `MY CART · ${count} POSITIONS`,
      () => navigateTo("cart")
    );
  }

  handleAddToCart() {
    try {
      // минимально возможная совместимость с твоим Cart-модулем:
      // предполагаем метод add(id, size, qty)
      if (typeof Cart.add === "function") {
        Cart.add(this.item?.id, this.size, this.qty);
      } else if (typeof Cart.addItem === "function") {
        Cart.addItem(this.item, { size: this.size, qty: this.qty });
      }
    } catch (e) {
      console.error("[Details] add to cart failed:", e);
    }
    // после добавления — просто меняем кнопку, НИКУДА НЕ ПЕРЕХОДИМ
    this.showCartButton();
  }
}