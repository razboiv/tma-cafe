// frontend/js/pages/details.js

import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuItem } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";
import { toDisplayCost } from "../utils/currency.js";

/**
 * Страница деталей блюда: фото, описание, выбор варианта и количества.
 * Работает с ids из /pages/details.html: details-*
 */
export default class DetailsPage extends Route {
  #item = null;
  #selectedVariant = null;
  #quantity = 1;

  constructor() {
    super("details", "/pages/details.html");
  }

  async load(params) {
    TelegramSDK.expand();

    // params может прийти строкой
    let p = {};
    try { p = typeof params === "string" ? JSON.parse(params || "{}") : (params || {}); }
    catch (_) { p = params || {}; }

    const itemId = p?.id ? String(p.id) : "";
    if (!itemId) {
      console.error("[DetailsPage] no item id in params", params);
      return;
    }

    try {
      const item = await getMenuItem(itemId);
      if (!item) {
        console.error("[DetailsPage] item not found", itemId);
        return;
      }
      this.#item = item;
      this.#selectedVariant = Array.isArray(item.variants) && item.variants.length ? item.variants[0] : null;
      this.#quantity = 1;

      this.#fillItem();
      this.#wireControls();

      // Главная кнопка в Telegram — «ADD TO CART»
      TelegramSDK.showMainButton("ADD TO CART", () => this.#addToCart());
    } catch (e) {
      console.error("[DetailsPage] failed to load item", e);
    }
  }

  #fillItem() {
    const item = this.#item;

    // Фото, название, описание
    loadImage($("#details-image"), item.image || item.photo || "");
    $("#details-name").text(item.name || "");
    $("#details-description").text(item.description || item.short || "");

    // Варианты (Small/Large и т.п.)
    const $variants = $("#details-variants");
    $variants.empty();

    const tpl = document.getElementById("details-variant-template");
    if (tpl && Array.isArray(item.variants)) {
      item.variants.forEach(variant => {
        const node = tpl.content.firstElementChild.cloneNode(true);
        node.querySelector(".details-variant-name").textContent = variant.name || variant.id;
        node.dataset.variantId = String(variant.id);
        node.addEventListener("click", () => {
          this.#selectedVariant = variant;
          this.#updateVariantUI();
        });
        $variants.append(node);
      });
    }

    this.#updateVariantUI();
    this.#updateQuantityUI();
  }

  #updateVariantUI() {
    const v = this.#selectedVariant;
    const cost = Number(v?.cost || v?.price || 0);
    const weight = v?.weight || "";

    // подсветка выбранного варианта
    const selectedId = String(v?.id || "");
    document.querySelectorAll("#details-variants .cafe-item-details-variant").forEach(btn => {
      btn.classList.toggle("selected", btn.dataset.variantId === selectedId);
    });

    // вес и цена
    $("#details-selected-variant-weight").text(weight);
    $("#details-price-value").text(toDisplayCost(cost));
  }

  #updateQuantityUI() {
    $("#details-quantity-value").text(this.#quantity);
  }

  #wireControls() {
    $("#details-quantity-decrease-button").off("click").on("click", () => {
      if (this.#quantity > 1) this.#quantity -= 1;
      this.#updateQuantityUI();
    });

    $("#details-quantity-increase-button").off("click").on("click", () => {
      this.#quantity += 1;
      this.#updateQuantityUI();
    });
  }

  #addToCart() {
    if (!this.#item || !this.#selectedVariant) return;
    Cart.addItem(this.#item, this.#selectedVariant, this.#quantity);

    // После добавления — показать кнопку корзины
    const count = Cart.getPortionCount ? Cart.getPortionCount() : 0;
    const label = count === 1 ? "MY CART · 1 POSITION" : `MY CART · ${count} POSITIONS`;
    TelegramSDK.showMainButton(label, () => navigateTo("cart"));
  }
}