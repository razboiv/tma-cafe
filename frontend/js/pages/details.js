// frontend/js/pages/details.js

import { Route } from "../routing/route.js";       // ← именованный импорт
import { navigateTo } from "../routing/router.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";

// приведение id к нормальному виду
function normalizeId(raw) {
  if (!raw) return null;
  if (typeof raw === "object" && raw.id) return raw.id;
  if (typeof raw === "string") {
    try { const p = JSON.parse(raw); if (p && p.id) return p.id; } catch {}
    return raw;
  }
  return null;
}

export default class DetailsPage extends Route {
  constructor() {
    super("details", "/pages/details.html");
  }

  async load(params) {
    console.log("[Details] load >", params);
    TelegramSDK.expand();

    this.itemId = normalizeId(params?.id ?? params);

    const getQty = () => {
      const el = document.querySelector("[data-role=qty-value]");
      const n = Number(el?.textContent || 1);
      return Number.isFinite(n) && n > 0 ? n : 1;
    };
    const getOption = () => {
      const active = document.querySelector('[data-role="opt"].is-active');
      return active?.dataset?.value || "default";
    };

    const showMyCart = () => {
      const count = (Cart.getPortionCount?.() ?? Cart.size?.() ?? 0);
      const text = count > 0
        ? `MY CART · ${count} POSITION${count > 1 ? "S" : ""}`
        : "MY CART";
      TelegramSDK.showMainButton(text, () => navigateTo("cart"));
    };

    const showAddToCart = () => {
      TelegramSDK.showMainButton("ADD TO CART", () => {
        const qty = getQty();
        const option = getOption();
        try {
          if (Cart.add) Cart.add({ id: this.itemId, option, qty });
          else if (Cart.addItem) Cart.addItem({ id: this.itemId, option, qty });
          else if (Cart.addPortion) Cart.addPortion(this.itemId, option, qty);
        } catch (e) {
          console.error("[Details] add to cart failed:", e);
        }
        TelegramSDK.showMainButton("MY CART · …");
        setTimeout(showMyCart, 60); // чтобы текущее нажатие не подхватило новый handler
      });
    };

    // Всегда начинаем с ADD TO CART
    showAddToCart();
  }
}