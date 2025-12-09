// frontend/js/pages/details.js
import { Route } from "../routing/route.js";
import { getMenuItem } from "../requests/requests.js";
import { TelegramSDK } from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";
import { toDisplayCost } from "../utils/currency.js";
import { Snackbar } from "../utils/snackbar.js";

export class DetailsPage extends Route {
  #item = null;
  #variant = null;
  #qty = 1;

  constructor() {
    super("details", "/pages/details.html");
  }

  async load(params) {
    TelegramSDK.expand?.();
    this.#qty = 1;
    this.#item = null;
    this.#variant = null;

    // достаём id из params (JSON строка)
    let id = "";
    try {
      const p = typeof params === "string" ? JSON.parse(params || "{}") : (params || {});
      id = String(p?.id || "");
    } catch {}

    if (!id) return;

    // грузим данные о блюде
    const data = await getMenuItem(id).catch(() => null);
    if (!data) return;

    const item = data.item || data || {};
    this.#item = item;

    // картинка
    const img = document.getElementById("cafe-item-details-image");
    if (img) {
      if (item.image) img.src = item.image;
      img.classList.remove("shimmer");
    }

    // текстовые поля
    const setText = (elId, val) => {
      const el = document.getElementById(elId);
      if (el) { el.textContent = val || ""; el.classList?.remove("shimmer"); }
    };
    setText("cafe-item-details-name", item.name);
    setText("cafe-item-details-description", item.description || item.short || "");

    // варианты
    const variants = Array.isArray(item.variants) ? item.variants : [];
    const box = document.getElementById("cafe-item-details-variants");
    if (box) {
      box.innerHTML = "";
      variants.forEach(v => {
        const b = document.createElement("button");
        b.className = "cafe-item-details-variant";
        b.id = v.id;
        b.textContent = v.name || String(v.id);
        b.addEventListener("click", () => this.#selectVariant(v));
        box.appendChild(b);
      });
    }

    // выбираем первый вариант по умолчанию
    if (variants.length) this.#selectVariant(variants[0]);

    // контролы количества
    this.#wireQtyControls();

    // основная кнопка — добавить в корзину
    TelegramSDK.showMainButton?.("ADD TO CART", () => {
      if (!this.#item || !this.#variant) return;
      Cart.addItem(this.#item, this.#variant, this.#qty);
      Snackbar?.showSnackbar?.(
        "cafe-item-details-container",
        "Successfully added to cart!",
        { bottom: "80px", "background-color": "var(--success-color)" }
      );
      TelegramSDK.notificationOccured?.("success");
    });
  }

  #selectVariant(v) {
    this.#variant = v;
    document.querySelectorAll(".cafe-item-details-variant").forEach(btn => {
      btn.classList.toggle("selected", btn.id == v.id || btn.dataset.variantId == String(v.id));
    });
    this.#refreshPriceAndWeight();
  }

  #refreshPriceAndWeight() {
    const price = this.#variant?.cost ?? this.#variant?.price ?? 0;
    const weight = this.#variant?.weight || "";
    const setText = (elId, val) => {
      const el = document.getElementById(elId);
      if (el) { el.textContent = val || ""; el.classList?.remove("shimmer"); }
    };
    setText("cafe-item-details-selected-variant-price", toDisplayCost(price));
    setText("cafe-item-details-selected-variant-weight", weight);
  }

  #wireQtyControls() {
    const dec = document.getElementById("cafe-item-details-quantity-decrease-button");
    const inc = document.getElementById("cafe-item-details-quantity-increase-button");
    const val = document.getElementById("cafe-item-details-quantity-value");

    const refresh = () => { if (val) val.textContent = String(this.#qty); };

    dec?.addEventListener("click", () => {
      if (this.#qty > 1) { this.#qty--; refresh(); TelegramSDK.impactOccured?.("light"); }
    });
    inc?.addEventListener("click", () => {
      this.#qty++; refresh(); TelegramSDK.impactOccured?.("light");
    });

    refresh();
  }
}