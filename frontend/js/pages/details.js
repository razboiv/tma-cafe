// frontend/js/pages/details.js

import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuItem } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";
import { toDisplayCost } from "../utils/currency.js";

/**
 * Страница деталей блюда: фото, описание, варианты и количество.
 * Разметка берётся из /pages/details.html — все id начинаются с `details-`.
 */
export default class DetailsPage extends Route {
  #item = null;
  #selectedVariant = null;
  #qty = 1;

  constructor() {
    super("details", "/pages/details.html");
  }

  async load(params) {
    console.log("[DetailsPage] load", params);
    TelegramSDK.expand();

    // разобрать параметры (может прийти строка или объект)
    let p = {};
    try { p = typeof params === "string" ? JSON.parse(params || "{}") : (params || {}); }
    catch { p = params || {}; }

    const itemId = p?.id ? String(p.id) : "";
    if (!itemId) {
      console.error("[DetailsPage] no item id in params:", params);
      return;
    }

    try {
      const item = await getMenuItem(itemId);
      if (!item) {
        console.error("[DetailsPage] item not found:", itemId);
        return;
      }

      this.#item = item;
      this.#selectedVariant = Array.isArray(item.variants) && item.variants.length
        ? item.variants[0]
        : null;
      this.#qty = 1;

      this.#renderItem();
      this.#wireQtyControls();

      TelegramSDK.showMainButton("ADD TO CART", () => this.#addToCart());
    } catch (e) {
      console.error("[DetailsPage] failed to load item", e);
    }
  }

  // ---- render ----
  #renderItem() {
    const it = this.#item;

    // фото, название, описание
    loadImage($("#details-image"), (it.image || it.photo || "").trim());
    $("#details-name").text(it.name || "");
    $("#details-description").text(it.description || it.short || "");

    // варианты (Small/Large и т.п.)
    const $variants = $("#details-variants");
    $variants.empty();

    const tpl = document.getElementById("details-variant-template");
    if (tpl && Array.isArray(it.variants)) {
      it.variants.forEach(v => {
        const node = tpl.content.firstElementChild.cloneNode(true);
        node.dataset.variantId = String(v.id);
        node.querySelector(".details-variant-name").textContent = v.name || v.id;
        node.addEventListener("click", () => {
          this.#selectedVariant = v;
          this.#updateVariantUI();
        });
        $variants.append(node);
      });
    }

    this.#updateVariantUI();
    this.#updateQtyUI();
  }

  #updateVariantUI() {
    const v = this.#selectedVariant;
    const cost = Number(v?.cost || v?.price || 0);
    const weight = v?.weight || "";

    // подсветка выбранного варианта
    const selectedId = String(v?.id || "");
    document.querySelectorAll("#details-variants .cafe-item-details-variant")
      .forEach(btn => btn.classList.toggle("selected", btn.dataset.variantId === selectedId));

    // вес + цена
    $("#details-selected-variant-weight").text(weight);
    $("#details-price-value").text(toDisplayCost(cost));
  }

  #updateQtyUI() {
    $("#details-quantity-value").text(this.#qty);
  }

  #wireQtyControls() {
    $("#details-quantity-decrease-button").off("click").on("click", () => {
      if (this.#qty > 1) this.#qty -= 1;
      this.#updateQtyUI();
    });

    $("#details-quantity-increase-button").off("click").on("click", () => {
      this.#qty += 1;
      this.#updateQtyUI();
    });
  }

  #addToCart() {
    if (!this.#item || !this.#selectedVariant) return;
    Cart.addItem(this.#item, this.#selectedVariant, this.#qty);

    // показать кнопку корзины
    const count = Cart.getPortionCount ? Cart.getPortionCount() : 0;
    const label = count === 1 ? "MY CART · 1 POSITION" : `MY CART · ${count} POSITIONS`;
    TelegramSDK.showMainButton(label, () => navigateTo("cart"));
  }
}