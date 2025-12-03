// frontend/js/pages/cart.js
import { Route } from "../routing/route.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";
import { createOrder } from "../requests/requests.js";

export default class CartPage extends Route {
  constructor() {
    super("cart", "/pages/cart.html");
    this._boundCheckout = null;
  }

  async load(params) {
    // На странице корзины наш глобальный хук НЕ должен перехватывать кнопку
    document.body.dataset.mainbutton = "checkout";
    try { TelegramSDK.hideMainButton(); } catch {}

    // кнопка Checkout (поддерживаем разные селекторы из шаблонов)
    const btn =
      document.querySelector('[data-action="checkout"]') ||
      document.querySelector(".js-checkout") ||
      document.getElementById("checkout") ||
      document.querySelector('button[type="submit"]');

    if (btn) {
      this._boundCheckout = (e) => { e.preventDefault(); this.#handleCheckout(btn); };
      btn.addEventListener("click", this._boundCheckout);
    }
  }

  destroy() {
    document.body.dataset.mainbutton = "";
    const btn =
      document.querySelector('[data-action="checkout"]') ||
      document.querySelector(".js-checkout") ||
      document.getElementById("checkout") ||
      document.querySelector('button[type="submit"]');
    if (btn && this._boundCheckout) btn.removeEventListener("click", this._boundCheckout);
    this._boundCheckout = null;
    super.destroy && super.destroy();
  }

  async #handleCheckout(btn) {
    try {
      btn?.setAttribute("disabled", "disabled");

      const items = Cart.getItems ? Cart.getItems() : [];
      if (!items.length) {
        (TelegramSDK.showAlert && TelegramSDK.showAlert("Cart is empty")) || alert("Cart is empty");
        return;
      }

      const payload = {
        _auth:
          (TelegramSDK.getInitData && TelegramSDK.getInitData()) ||
          (window.Telegram?.WebApp?.initData ?? ""),
        cartItems: items.map((it) => ({
          cafeItem: { id: it.cafeItem.id, name: it.cafeItem.name },
          variant: { name: it.variant.name, cost: Number(it.variant.cost) },
          quantity: Number(it.quantity),
        })),
      };

      const res = await createOrder(payload);
      if (!res || !res.invoiceUrl) throw new Error("No invoiceUrl in response");

      if (typeof TelegramSDK.openInvoice === "function") {
        TelegramSDK.openInvoice(res.invoiceUrl, (status) => console.log("invoice:", status));
      } else if (window.Telegram?.WebApp?.openInvoice) {
        window.Telegram.WebApp.openInvoice(res.invoiceUrl, (status) => console.log("invoice:", status));
      } else {
        window.location.href = res.invoiceUrl;
      }

      // при необходимости можно очищать корзину:
      // Cart.clear();
    } catch (err) {
      console.error("Checkout error:", err);
      (TelegramSDK.showAlert && TelegramSDK.showAlert("Не удалось создать оплату. Попробуйте ещё раз.")) ||
        alert("Не удалось создать оплату. Попробуйте ещё раз.");
    } finally {
      btn?.removeAttribute("disabled");
    }
  }
}