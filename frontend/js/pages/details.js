// frontend/js/pages/details.js

import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuItem } from "../requests/requests.js"; // <- правильный экспорт
import TelegramSDK from "../telegram/telegram.js";
import { loadImage } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";
import { toDisplayCost } from "../utils/currency.js";

export default class DetailsPage extends Route {
  constructor() { super("details", "/pages/details.html"); }

  async load(params) {
    // режим «добавления», чтобы персист-хук не перехватывал кнопку
    document.body.dataset.mainbutton = "add";

    const id = params?.id;
    if (!id) { console.error("[Details] no id"); return; }

    // тянем товар
    const item = await this.#fetchItem(id);
    if (!item) { console.error("[Details] item not found", id); return; }

    this.item = item;
    this.qty = 1;
    this.variant = item?.variants?.[0] ?? null;

    this.#renderItem();

    // показываем «ADD TO CART»
    const onAdd = () => this.#addToCart();
    try {
      TelegramSDK.showMainButton("ADD TO CART", onAdd);
      const W = window.Telegram?.WebApp;
      W?.MainButton?.setText?.("ADD TO CART");
      W?.MainButton?.onClick?.(onAdd);
      W?.onEvent?.("mainButtonClicked", onAdd);
      W?.MainButton?.enable?.(); W?.MainButton?.show?.();
    } catch {}
  }

  async #fetchItem(id) {
    try {
      if (typeof getMenuItem === "function") return await getMenuItem(id);
    } catch (e) { console.warn("getMenuItem failed, fallback to fetch", e); }
    try {
      const res = await fetch(`${location.origin}/menu/details/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch (e) {
      console.error("fetch details failed", e);
      return null;
    }
  }

  #renderItem() {
    const it = this.item;

    // убираем скелеты и подставляем данные
    $("#cafe-item-details-image").each((_, el) => {
      loadImage(it.image, $(el));
      $(el).removeClass("shimmer");
    });
    $("#cafe-item-details-name").text(it.name || "").removeClass("shimmer");
    $("#cafe-item-details-description").text(it.description || "").removeClass("shimmer");
    $("#cafe-item-details-section-title").text("Price").removeClass("shimmer");

    // варианты
    const $variants = $("#cafe-item-details-variants").removeClass("shimmer").empty();
    (it.variants || []).forEach((v, i) => {
      const $b = $('<button class="cafe-item-details-variant"></button>').text(v.name || "");
      if (i === 0) $b.addClass("active");
      $b.on("click", () => {
        this.variant = v;
        this.#updatePrice();
        $variants.find(".active").removeClass("active");
        $b.addClass("active");
      });
      $variants.append($b);
    });

    // количество
    $("#cafe-item-details-quantity-value").text(this.qty);
    $("#cafe-item-details-quantity-increase-button")
      .off("click").on("click", () => {
        this.qty = Math.min(99, this.qty + 1);
        $("#cafe-item-details-quantity-value").text(this.qty);
        this.#updatePrice();
      });
    $("#cafe-item-details-quantity-decrease-button")
      .off("click").on("click", () => {
        this.qty = Math.max(1, this.qty - 1);
        $("#cafe-item-details-quantity-value").text(this.qty);
        this.#updatePrice();
      });

    this.#updatePrice();
  }

  #updatePrice() {
    const cost = Number(this.variant?.cost ?? 0) * Number(this.qty ?? 1);
    $("#cafe-item-details-selected-variant-price")
      .text(toDisplayCost(cost)).removeClass("shimmer");
    $("#cafe-item-details-selected-variant-weight")
      .text(this.variant?.weight || "").removeClass("shimmer");
  }

  #addToCart() {
    if (!this.item || !this.variant) return;

    // добавляем — без перехода
    Cart.addItem(this.item, this.variant, this.qty);

    // переключаем главную кнопку на «MY CART · N»
    document.body.dataset.mainbutton = "cart";
    const n = (Cart.getPortionCount && Cart.getPortionCount()) || 1;
    const text = n === 1 ? "MY CART · 1 POSITION" : `MY CART · ${n} POSITIONS`;

    try {
      const W = window.Telegram?.WebApp;
      W?.MainButton?.setText?.(text);
      W?.MainButton?.onClick?.(() => navigateTo("cart"));
      W?.onEvent?.("mainButtonClicked", () => navigateTo("cart"));
      W?.MainButton?.enable?.(); W?.MainButton?.show?.();
      TelegramSDK.showMainButton(text, () => navigateTo("cart"));
    } catch {}
  }
}