// frontend/js/pages/details.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuItem } from "../requests/requests.js";
import { TelegramSDK } from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";
import { toDisplayCost } from "../utils/currency.js";

// простой helper: убрать скелетоны и показать контент
function revealContent() {
  document.querySelectorAll("[data-skeleton]").forEach(n => n.remove());
  document.querySelectorAll("[data-content]").forEach(n => (n.style.display = ""));
}

export default class DetailsPage extends Route {
  #item = null;
  #variant = null;
  #qty = 1;

  constructor() {
    super("details", "/pages/details.html");
  }

  async load(params) {
    console.log("[DetailsPage] load", params);
    TelegramSDK.expand();

    // params может быть строкой
    let p = {};
    try { p = typeof params === "string" ? JSON.parse(params || "{}") : (params || {}); }
    catch { p = params || {}; }

    const id = p?.id ? String(p.id) : "";
    if (!id) {
      console.error("[DetailsPage] no item id in params:", params);
      return;
    }

    const item = await getMenuItem(id);
    if (!item) {
      console.error("[DetailsPage] item not found:", id);
      return;
    }

    this.#item = item;
    this.#variant = Array.isArray(item.variants) && item.variants.length ? item.variants[0] : null;
    this.#qty = 1;

    this.#render();
    this.#wireQtyControls();
    TelegramSDK.showMainButton("ADD TO CART", () => this.#addToCart());
  }

  #render() {
    const it = this.#item;

    // изображение
    const img = document.getElementById("cafe-item-details-image");
    const cover = img?.closest(".details-cover");
    img.onload = () => {
      img.style.display = "block";
      cover?.querySelectorAll("[data-skeleton]").forEach(n => n.remove());
    };
    img.onerror = () => { img.style.display = "none"; };
    img.src = (it.image || it.photo || "").trim();

    // текстовые поля
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || ""; };
    setText("cafe-item-details-name", it.name);
    setText("cafe-item-details-description", it.description || it.short);

    // варианты
    const box = document.getElementById("cafe-item-details-variants");
    box.innerHTML = "";
    if (Array.isArray(it.variants)) {
      it.variants.forEach(v => {
        const b = document.createElement("button");
        b.className = "cafe-item-details-variant";
        b.dataset.variantId = String(v.id);
        b.textContent = v.name || v.id;
        b.addEventListener("click", () => {
          this.#variant = v;
          this.#updateVariantUI();
        });
        box.appendChild(b);
      });
    }

    this.#updateVariantUI();
    this.#updateQtyUI();
    revealContent();
  }

  #updateVariantUI() {
    const v = this.#variant;
    const price = Number(v?.cost || v?.price || 0);
    const weight = v?.weight || "";

    // подсветка активного варианта (класс .active)
    const selectedId = String(v?.id || "");
    document
      .querySelectorAll("#cafe-item-details-variants .cafe-item-details-variant")
      .forEach(btn => btn.classList.toggle("active", btn.dataset.variantId === selectedId));

    // цена и вес
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || ""; };
    setText("cafe-item-details-selected-variant-price", toDisplayCost(price));
    setText("cafe-item-details-selected-variant-weight", weight);
  }

  #updateQtyUI() {
    const el = document.getElementById("cafe-item-details-quantity-value");
    if (el) el.textContent = String(this.#qty);
  }

  #wireQtyControls() {
    const dec = document.getElementById("cafe-item-details-quantity-decrease-button");
    const inc = document.getElementById("cafe-item-details-quantity-increase-button");
    dec?.addEventListener("click", () => { if (this.#qty > 1) { this.#qty--; this.#updateQtyUI(); } });
    inc?.addEventListener("click", () => { this.#qty++; this.#updateQtyUI(); });
  }

  #addToCart() {
    if (!this.#item || !this.#variant) return;
    Cart.addItem(this.#item, this.#variant, this.#qty);

    const count = Cart.getPortionCount ? Cart.getPortionCount() : 0;
    const label = count === 1 ? "MY CART · 1 POSITION" : `MY CART · ${count} POSITIONS`;
    TelegramSDK.showMainButton(label, () => navigateTo("cart"));
  }
}
