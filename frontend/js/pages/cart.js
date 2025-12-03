// frontend/js/pages/cart.js
import { Route } from "../routing/route.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";
import { createOrder } from "../requests/requests.js";
import { toDisplayCost } from "../utils/currency.js";

export default class CartPage extends Route {
  constructor() {
    super("cart", "/pages/cart.html");
    this._onCheckout = null;
  }

  async load(params) {
    // На странице корзины — не перехватываем MainButton глобальным хендлером
    document.body.dataset.mainbutton = "checkout";
    try { TelegramSDK.hideMainButton(); } catch {}

    // Отрисуем корзину и повесим обработчики
    this.render();
    this.bindControls();

    // Кнопка Checkout
    const btn =
      document.querySelector('[data-action="checkout"]') ||
      document.querySelector(".js-checkout") ||
      document.getElementById("checkout") ||
      document.querySelector('button[type="submit"]');

    if (btn) {
      this._onCheckout = (e) => { e.preventDefault(); this.#checkout(btn); };
      btn.addEventListener("click", this._onCheckout);
    }
  }

  destroy() {
    document.body.dataset.mainbutton = "";

    const btn =
      document.querySelector('[data-action="checkout"]') ||
      document.querySelector(".js-checkout") ||
      document.getElementById("checkout") ||
      document.querySelector('button[type="submit"]');
    if (btn && this._onCheckout) btn.removeEventListener("click", this._onCheckout);
    this._onCheckout = null;

    super.destroy && super.destroy();
  }

  // ---------- UI ----------

  render() {
    const items = (Cart.getItems && Cart.getItems()) || [];
    const list =
      document.querySelector("#cart-items") ||
      document.querySelector(".cart-items") ||
      document.querySelector('[data-list="cart"]');

    const emptyBlock =
      document.querySelector("#cart-empty") ||
      document.querySelector(".cart-empty");

    const totalNode =
      document.querySelector("#cart-total") ||
      document.querySelector('[data-id="cart-total"]') ||
      document.querySelector(".cart-total");

    // очистим
    if (list) list.innerHTML = "";

    if (!items.length) {
      if (emptyBlock) emptyBlock.style.display = "";
      if (totalNode) totalNode.textContent = toDisplayCost(0);
      return;
    }
    if (emptyBlock) emptyBlock.style.display = "none";

    // шаблон, если есть
    const tplNode = document.querySelector("#cart-item-template");
    const tplHtml = tplNode ? tplNode.innerHTML : null;

    // рендер позиций
    for (const it of items) {
      const qty = Number(it.quantity ?? it.count ?? 0);
      const name = it.cafeItem?.name || "";
      const variant = it.variant?.name || "";
      const cost = Number(it.variant?.cost || 0);

      let row;
      if (tplHtml) {
        row = document.createElement("div");
        row.innerHTML = tplHtml;
        row = row.firstElementChild;
      } else {
        // простой фолбэк, если в шаблоне нет template
        row = document.createElement("div");
        row.className = "cart-item";
        row.style.padding = "10px 0";
        row.innerHTML = `
          <div class="cart-item__line">
            <div class="cart-item__title">${name}${variant ? `, ${variant}` : ""}</div>
            <div class="cart-item__price">${toDisplayCost(cost * qty)}</div>
          </div>
          <div class="cart-item__qty">
            <button class="js-dec" aria-label="dec">−</button>
            <span class="js-qty">${qty}</span>
            <button class="js-inc" aria-label="inc">+</button>
            <button class="js-remove" aria-label="remove">×</button>
          </div>
        `;
      }

      // дата-атрибуты, чтобы знать что обновлять
      row.dataset.itemId = String(it.cafeItem?.id ?? "");
      row.dataset.variantName = String(it.variant?.name ?? "");
      row.querySelector(".js-qty")?.replaceWith(Object.assign(document.createElement("span"), {className:"js-qty", textContent:String(qty)}));
      row.querySelector(".js-price")?.replaceWith(Object.assign(document.createElement("span"), {className:"js-price", textContent:toDisplayCost(cost * qty)}));

      // кнопки +/-/remove
      row.querySelector(".js-inc")?.addEventListener("click", () => this.changeQty(it, +1, row));
      row.querySelector(".js-dec")?.addEventListener("click", () => this.changeQty(it, -1, row));
      row.querySelector(".js-remove")?.addEventListener("click", () => this.removeItem(it, row));

      if (list) list.appendChild(row);
    }

    // total
    const total = items.reduce((s, it) => s + Number(it.variant?.cost || 0) * Number(it.quantity ?? it.count ?? 0), 0);
    if (totalNode) totalNode.textContent = toDisplayCost(total);
  }

  bindControls() {
    // Если корзина зависит от внешних событий — можно подписаться и перерисовывать.
    // На всякий случай — простая «поддержка живой»: обновляем раз в 1.5 сек.
    if (this._liveTimer) clearInterval(this._liveTimer);
    this._liveTimer = setInterval(() => this.render(), 1500);
  }

  changeQty(item, delta, row) {
    try {
      // если есть методы в Cart — используем их
      if (typeof Cart.changeItemQuantity === "function") {
        Cart.changeItemQuantity(item, delta);
      } else {
        // фолбэк: меняем и сохраняем сами (если есть save)
        const list = (Cart.getItems && Cart.getItems()) || [];
        const target = list.find(
          x => x.cafeItem?.id === item.cafeItem?.id && x.variant?.name === item.variant?.name
        );
        if (target) {
          const q = Number(target.quantity ?? target.count ?? 0) + delta;
          target.quantity = Math.max(0, q);
          if (typeof Cart.save === "function") Cart.save(list);
        }
      }
    } catch {}

    // обновим UI
    this.render();
  }

  removeItem(item, row) {
    try {
      if (typeof Cart.removeItem === "function") {
        Cart.removeItem(item);
      } else {
        const list = (Cart.getItems && Cart.getItems()) || [];
        const idx = list.findIndex(
          x => x.cafeItem?.id === item.cafeItem?.id && x.variant?.name === item.variant?.name
        );
        if (idx >= 0) {
          list.splice(idx, 1);
          if (typeof Cart.save === "function") Cart.save(list);
        }
      }
    } catch {}
    this.render();
  }

  // ---------- Checkout ----------

  async #checkout(btn) {
    try {
      btn?.setAttribute("disabled", "disabled");

      const items = (Cart.getItems && Cart.getItems()) || [];
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
          quantity: Number(it.quantity ?? it.count ?? 0),
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
    } catch (err) {
      console.error("Checkout error:", err);
      (TelegramSDK.showAlert && TelegramSDK.showAlert("Не удалось создать оплату. Попробуйте ещё раз."))
        || alert("Не удалось создать оплату. Попробуйте ещё раз.");
    } finally {
      btn?.removeAttribute("disabled");
    }
  }
}